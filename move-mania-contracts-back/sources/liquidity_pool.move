module zion::liquidity_pool {

  use std::string;
  use std::signer;
  use aptos_framework::event;
  use aptos_framework::option;
  use aptos_framework::math128;
  use aptos_framework::account;
  use aptos_framework::coin::{Self, Coin};

  use zion::z_apt::ZAPT;

  friend zion::crash;

  const LP_COIN_DECIMALS: u8 = 8;
  const SEED: vector<u8> = b"zion-liquidity-pool";

  struct LPCoin {}

  struct LiquidityPool has key {
    reserve_coin: Coin<ZAPT>,
    locked_liquidity: Coin<LPCoin>,
    // mint cap of the specific pool's LP token
    lp_coin_mint_cap: coin::MintCapability<LPCoin>,
    // burn cap of the specific pool's LP token
    lp_coin_burn_cap: coin::BurnCapability<LPCoin>
  }

  struct State has key {
    // signer cap of the module's resource account
    signer_cap: account::SignerCapability,
    deposit_events: event::EventHandle<DepositEvent>,
    withdraw_events: event::EventHandle<WithdrawEvent>,
    extract_events: event::EventHandle<ExtractEvent>,
    put_events: event::EventHandle<PutEvent>,
    lock_events: event::EventHandle<LockEvent>
  }

  struct DepositEvent has drop, store {
    address: address, 
    apt_amount: u64,
    lp_coin_amount: u64
  }

  struct WithdrawEvent has drop, store {
    address: address, 
    apt_amount: u64,
    lp_coin_amount: u64
  }

  struct ExtractEvent has drop, store {
    apt_amount: u64
  }

  struct PutEvent has drop, store {
    apt_amount: u64
  }

  struct LockEvent has drop, store {
    address: address, 
    lp_coin_amount: u64
  }

  fun init_module(admin: &signer) {
    let (resource_account_signer, signer_cap) = account::create_resource_account(admin, SEED);

    let (lp_coin_burn_cap, lp_coin_freeze_cap, lp_coin_mint_cap) = 
      coin::initialize<LPCoin>(
        admin, 
        string::utf8(b"Zion bets LP coin"),
        string::utf8(b"ZBET"),
        LP_COIN_DECIMALS,
        true
      );
    coin::destroy_freeze_cap(lp_coin_freeze_cap);

    move_to(
      &resource_account_signer,
      LiquidityPool {
        reserve_coin: coin::zero<ZAPT>(),
        locked_liquidity: coin::zero<LPCoin>(),
        lp_coin_mint_cap,
        lp_coin_burn_cap
      }
    );

    move_to<State>(
      &resource_account_signer,
      State {
        signer_cap: signer_cap,
        deposit_events: account::new_event_handle(&resource_account_signer),
        withdraw_events: account::new_event_handle(&resource_account_signer),
        extract_events: account::new_event_handle(&resource_account_signer),
        put_events: account::new_event_handle(&resource_account_signer),
        lock_events: account::new_event_handle(&resource_account_signer)
      }
    );
  }

  public entry fun supply_liquidity(
    supplier: &signer,
    supply_amount: u64,
  ) acquires LiquidityPool, State {
    let liquidity_pool = borrow_global_mut<LiquidityPool>(get_resource_address());

    let reserve_amount = coin::value(&liquidity_pool.reserve_coin);
    let lp_coin_supply = *option::borrow(&coin::supply<LPCoin>());

    let amount_lp_coins_to_mint = if (lp_coin_supply == 0) {
      supply_amount
    } else {
      (math128::mul_div((supply_amount as u128), lp_coin_supply, (reserve_amount as u128)) as u64)
    };

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).deposit_events,
      DepositEvent {
        address: signer::address_of(supplier),
        apt_amount: supply_amount,
        lp_coin_amount: amount_lp_coins_to_mint
      }
    );

    let supplied_coin = coin::withdraw(supplier, supply_amount);
    coin::merge(&mut liquidity_pool.reserve_coin, supplied_coin);

    let lp_coin = coin::mint(amount_lp_coins_to_mint, &liquidity_pool.lp_coin_mint_cap);
    coin::register<LPCoin>(supplier);
    coin::deposit(signer::address_of(supplier), lp_coin);
  }

  public entry fun remove_liquidity(
    supplier: &signer, 
    lp_coin_amount: u64
  ) acquires LiquidityPool, State {
    let liquidity_pool = borrow_global_mut<LiquidityPool>(get_resource_address());

    let reserve_amount = coin::value(&liquidity_pool.reserve_coin);
    let lp_coin_supply = *option::borrow(&coin::supply<LPCoin>());

    let amount_reserve_to_remove = (math128::mul_div((lp_coin_amount as u128), (reserve_amount as u128), lp_coin_supply) as u64);
    let remove_reserve_coin = coin::extract(&mut liquidity_pool.reserve_coin, amount_reserve_to_remove);
    coin::deposit(signer::address_of(supplier), remove_reserve_coin);

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).withdraw_events,
      WithdrawEvent {
        address: signer::address_of(supplier),
        apt_amount: amount_reserve_to_remove,
        lp_coin_amount
      }
    );

    let lp_coin_to_remove = coin::withdraw(supplier, lp_coin_amount);
    coin::burn(lp_coin_to_remove, &liquidity_pool.lp_coin_burn_cap);
  }

  public entry fun lock_lp_coins(
    owner: &signer, 
    lp_coin_amount: u64
  ) acquires LiquidityPool, State {
    let liquidity_pool = borrow_global_mut<LiquidityPool>(get_resource_address());  
    let lp_coin_to_lock = coin::withdraw(owner, lp_coin_amount);
    coin::merge(&mut liquidity_pool.locked_liquidity, lp_coin_to_lock);

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).lock_events,
      LockEvent {
        address: signer::address_of(owner),
        lp_coin_amount
      }
    );
  } 

  public(friend) fun extract_reserve_coins(
    amount: u64
  ): Coin<ZAPT> acquires LiquidityPool, State {
    let liquidity_pool = borrow_global_mut<LiquidityPool>(get_resource_address());

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).extract_events,
      ExtractEvent {
        apt_amount: amount
      }
    );

    coin::extract(&mut liquidity_pool.reserve_coin, amount)
  }

  public fun put_reserve_coins(
    coin: Coin<ZAPT>
  ) acquires LiquidityPool, State {
    let liquidity_pool = borrow_global_mut<LiquidityPool>(get_resource_address());

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).put_events,
      PutEvent {
        apt_amount: coin::value(&coin)
      }
    );

    coin::merge(&mut liquidity_pool.reserve_coin, coin);
  }

  /* 
    Create and return the address of the module's resource account
    @return - address of the module's resource account
  */ 
  inline fun get_resource_address(): address {
    account::create_resource_address(&@zion, SEED)
  }

  #[view]
  public fun get_pool_supply(): u64 acquires LiquidityPool {
    let liquidity_pool = borrow_global<LiquidityPool>(get_resource_address());
    coin::value(&liquidity_pool.reserve_coin)
  }

  #[view]
  public fun get_lp_coin_supply(): u128 {
    *option::borrow(&coin::supply<LPCoin>())
  }

  #[view]
  public fun get_amount_of_locked_liquidity(): u64 acquires LiquidityPool {
    let liquidity_pool = borrow_global<LiquidityPool>(get_resource_address());
    coin::value(&liquidity_pool.locked_liquidity)
  }
}