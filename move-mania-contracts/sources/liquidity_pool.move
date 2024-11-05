module zion::liquidity_pool {

  use std::string::{Self, String};
  use std::signer;
  use std::object::{Self, Object};
  use aptos_framework::event;
  use aptos_framework::option;
  use aptos_framework::math128;
  use aptos_framework::account;
  use aptos_framework::coin::{Self, Coin};
  use aptos_framework::primary_fungible_store::{Self};
  use aptos_framework::fungible_asset::{Self, MintRef, BurnRef, FungibleStore, Metadata};

  use zion::z_apt::ZAPT;
  use zion::whitelist;

  friend zion::crash;

  const LP_COIN_DECIMALS: u8 = 8;
  const SEED: vector<u8> = b"zion-liquidity-pool";

  struct LiquidityPool<phantom BettingCoinType, phantom LPCoinType> has key {
    reserve_coin: Coin<BettingCoinType>,
    locked_liquidity: Coin<LPCoinType>,
    // mint cap of the specific pool's LP token
    lp_coin_mint_cap: coin::MintCapability<LPCoinType>,
    // burn cap of the specific pool's LP token
    lp_coin_burn_cap: coin::BurnCapability<LPCoinType>
  }

  struct LiquidityPoolFA<phantom LiquidityPoolType> has key {
    reserve_metadata: Object<Metadata>,
    lp_metadata: Object<Metadata>,
    lp_mint_ref: MintRef,
    lp_burn_ref: BurnRef
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

    //Whitlist gets initialized in crash module.
    if(!whitelist::whitelist_exists(signer::address_of(&resource_account_signer))){
      whitelist::create_module_whitelist(&resource_account_signer, admin); 
    };

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

  public entry fun init_fa_LP_pool<LiquidityPoolType>(
    admin: &signer,
    reserve_metadata: Object<Metadata>,
    lp_token_name: String, 
    lp_token_ticker: String, 
    lp_token_decimals: u8,
    lp_icon_uri: String,
    lp_site_uri: String
  ) acquires State {
    let constructor_ref = &object::create_named_object(admin, *string::bytes(&lp_token_ticker));
    primary_fungible_store::create_primary_store_enabled_fungible_asset(
        constructor_ref,
        option::none(),
        lp_token_name, 
        lp_token_ticker, 
        lp_token_decimals, 
        lp_icon_uri, 
        lp_site_uri,
    );
    
    let lp_mint_ref = fungible_asset::generate_mint_ref(constructor_ref);
 
    let lp_burn_ref = fungible_asset::generate_burn_ref(constructor_ref);

    let pool_state = borrow_global<State>(get_resource_address());
    let resource_account_signer = account::create_signer_with_capability(&pool_state.signer_cap);

    move_to(
      &resource_account_signer,
      LiquidityPoolFA<LiquidityPoolType> {
        reserve_metadata,
        lp_metadata: object::object_from_constructor_ref<Metadata>(constructor_ref),
        lp_mint_ref,
        lp_burn_ref
      }
    );

  }

  public entry fun init_LP_pool<BettingCoinType, LPCoinType>(
    admin: &signer,
    lp_token_name: String, 
    lp_token_ticker: String, 
    lp_token_decimals: u8
  ) acquires State {

    whitelist::assert_is_admin(get_resource_address(), admin);

    let (lp_coin_burn_cap, lp_coin_freeze_cap, lp_coin_mint_cap) = 
      coin::initialize<LPCoinType>(
        admin, 
        lp_token_name,
        lp_token_ticker,
        lp_token_decimals,
        true
      );
    coin::destroy_freeze_cap(lp_coin_freeze_cap);

    let pool_state = borrow_global<State>(get_resource_address());
    let resource_account_signer = account::create_signer_with_capability(&pool_state.signer_cap);

    move_to(
      &resource_account_signer,
      LiquidityPool<BettingCoinType, LPCoinType> {
        reserve_coin: coin::zero<BettingCoinType>(),
        locked_liquidity: coin::zero<LPCoinType>(),
        lp_coin_mint_cap,
        lp_coin_burn_cap
      }
    );
  }

  public entry fun supply_liquidity<BettingCoinType, LPCoinType>(
    supplier: &signer,
    supply_amount: u64,
  ) acquires LiquidityPool, State {
    let liquidity_pool = borrow_global_mut<LiquidityPool<BettingCoinType, LPCoinType>>(get_resource_address());

    let reserve_amount = coin::value(&liquidity_pool.reserve_coin);
    let lp_coin_supply = *option::borrow(&coin::supply<LPCoinType>());

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
    coin::register<LPCoinType>(supplier);
    coin::deposit(signer::address_of(supplier), lp_coin);
  }

  public entry fun supply_fa_liquidity<LiquidityPoolType>(
    supplier: &signer,
    supply_amount: u64,
  ) acquires LiquidityPoolFA, State {
    let liquidity_pool = borrow_global_mut<LiquidityPoolFA<LiquidityPoolType>>(get_resource_address());

    let reserve_metadata = liquidity_pool.reserve_metadata;
    let lp_metadata = liquidity_pool.lp_metadata;
    
    let reserve_amount = primary_fungible_store::balance(get_resource_address(), reserve_metadata);
    let lp_coin_supply = fungible_asset::supply(lp_metadata);

    let amount_lp_coins_to_mint = if (option::is_none(&lp_coin_supply) || *option::borrow(&lp_coin_supply) == 0) {
      supply_amount
    } else {
      (math128::mul_div((supply_amount as u128), *option::borrow(&lp_coin_supply), (reserve_amount as u128)) as u64)
    };

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).deposit_events,
      DepositEvent {
        address: signer::address_of(supplier),
        apt_amount: supply_amount,
        lp_coin_amount: amount_lp_coins_to_mint
      }
    );

    primary_fungible_store::transfer(supplier, reserve_metadata, get_resource_address(), supply_amount);
    primary_fungible_store::mint(&liquidity_pool.lp_mint_ref, signer::address_of(supplier), amount_lp_coins_to_mint);
  }

  public entry fun remove_liquidity<BettingCoinType, LPCoinType>(
    supplier: &signer, 
    lp_coin_amount: u64
  ) acquires LiquidityPool, State {
    let liquidity_pool = borrow_global_mut<LiquidityPool<BettingCoinType, LPCoinType>>(get_resource_address());

    let reserve_amount = coin::value(&liquidity_pool.reserve_coin);
    let lp_coin_supply = *option::borrow(&coin::supply<LPCoinType>());

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

    public entry fun remove_fa_liquidity<LiquidityPoolType>(
    supplier: &signer, 
    lp_coin_amount: u64
  ) acquires LiquidityPoolFA, State {
    let liquidity_pool = borrow_global_mut<LiquidityPoolFA<LiquidityPoolType>>(get_resource_address());

    let reserve_metadata = liquidity_pool.reserve_metadata;
    let lp_metadata = liquidity_pool.lp_metadata;

    let reserve_amount = primary_fungible_store::balance(get_resource_address(), reserve_metadata);
    let lp_coin_supply_opt = fungible_asset::supply(lp_metadata);
    
    let lp_coin_supply = if(option::is_none(&lp_coin_supply_opt)){
      0
    } else {
      *option::borrow(&lp_coin_supply_opt)
    };

    let amount_reserve_to_remove = (math128::mul_div((lp_coin_amount as u128), (reserve_amount as u128), lp_coin_supply) as u64);

    let pool_state = borrow_global<State>(get_resource_address());
    let resource_account_signer = account::create_signer_with_capability(&pool_state.signer_cap);
    primary_fungible_store::transfer(&resource_account_signer, reserve_metadata, signer::address_of(supplier), amount_reserve_to_remove);

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).withdraw_events,
      WithdrawEvent {
        address: signer::address_of(supplier),
        apt_amount: amount_reserve_to_remove,
        lp_coin_amount
      }
    );

    primary_fungible_store::burn(&liquidity_pool.lp_burn_ref, signer::address_of(supplier), lp_coin_amount)
  }

  public entry fun lock_lp_coins<BettingCoinType, LPCoinType>(
    owner: &signer, 
    lp_coin_amount: u64
  ) acquires LiquidityPool, State {
    let liquidity_pool = borrow_global_mut<LiquidityPool<BettingCoinType, LPCoinType>>(get_resource_address());  
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

  public entry fun lock_lp_coins_fa<LiquidityPoolType>(
    owner: &signer, 
    lp_coin_amount: u64
  ) acquires LiquidityPoolFA, State {
    let liquidity_pool = borrow_global_mut<LiquidityPoolFA<LiquidityPoolType>>(get_resource_address());  
    let reserve_metadata = liquidity_pool.reserve_metadata;
    let lp_metadata = liquidity_pool.lp_metadata;

    primary_fungible_store::transfer(owner, lp_metadata, get_resource_address(), lp_coin_amount);

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).lock_events,
      LockEvent {
        address: signer::address_of(owner),
        lp_coin_amount
      }
    );
  } 

  public(friend) fun extract_reserve_coins<BettingCoinType, LPCoinType>(
    amount: u64
  ): Coin<BettingCoinType> acquires LiquidityPool, State {
    let liquidity_pool = borrow_global_mut<LiquidityPool<BettingCoinType, LPCoinType>>(get_resource_address());

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).extract_events,
      ExtractEvent {
        apt_amount: amount
      }
    );

    coin::extract(&mut liquidity_pool.reserve_coin, amount)
  }

  public(friend) fun extract_reserve_coins_fa<LiquidityPoolType>(
    amount: u64,
    to: address
  ) acquires LiquidityPoolFA, State {
    let liquidity_pool = borrow_global_mut<LiquidityPoolFA<LiquidityPoolType>>(get_resource_address());

    let reserve_metadata = liquidity_pool.reserve_metadata;
    let lp_metadata = liquidity_pool.lp_metadata;

    let pool_state = borrow_global<State>(get_resource_address());
    let resource_account_signer = account::create_signer_with_capability(&pool_state.signer_cap);

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).extract_events,
      ExtractEvent {
        apt_amount: amount
      }
    );

    primary_fungible_store::transfer(&resource_account_signer, reserve_metadata, to, amount);
  }

  public fun put_reserve_coins<BettingCoinType, LPCoinType>(
    coin: Coin<BettingCoinType>
  ) acquires LiquidityPool, State {
    let liquidity_pool = borrow_global_mut<LiquidityPool<BettingCoinType, LPCoinType>>(get_resource_address());

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).put_events,
      PutEvent {
        apt_amount: coin::value(&coin)
      }
    );

    coin::merge(&mut liquidity_pool.reserve_coin, coin);
  }

  public fun put_reserve_coins_fa<LiquidityPoolType>(
    from: &signer,
    amount: u64
  ) acquires LiquidityPoolFA, State {
    let liquidity_pool = borrow_global_mut<LiquidityPoolFA<LiquidityPoolType>>(get_resource_address());

    let reserve_metadata = liquidity_pool.reserve_metadata;
    let lp_metadata = liquidity_pool.lp_metadata;

    let pool_state = borrow_global<State>(get_resource_address());

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).put_events,
      PutEvent {
        apt_amount: amount
      }
    );

    primary_fungible_store::transfer(from, reserve_metadata, get_resource_address(), amount);
  }

  // /* 
  //   Create and return the address of the module's resource account
  //   @return - address of the module's resource account
  // */ 
  inline fun get_resource_address(): address {
    account::create_resource_address(&@zion, SEED)
  }

  // #[view]
  public fun get_pool_supply<BettingCoinType, LPCoinType>(): u64 acquires LiquidityPool {
    let liquidity_pool = borrow_global<LiquidityPool<BettingCoinType, LPCoinType>>(get_resource_address());
    coin::value(&liquidity_pool.reserve_coin)
  }

  // #[view]
  public fun get_lp_coin_supply<LPCoinType>(): u128 {
    *option::borrow(&coin::supply<LPCoinType>())
  }

  // #[view]
  public fun get_amount_of_locked_liquidity<BettingCoinType, LPCoinType>(): u64 acquires LiquidityPool {
    let liquidity_pool = borrow_global<LiquidityPool<BettingCoinType, LPCoinType>>(get_resource_address());
    coin::value(&liquidity_pool.locked_liquidity)
  }

  #[test_only]
    fun create_test_token(admin: &signer): (ConstructorRef, Object<Metadata>, MintRef) {
        let (constructor_ref, test_token) = fungible_asset::create_test_token(admin);

        let (mint_ref, _, _) =
            primary_fungible_store::init_test_metadata_with_primary_store_enabled(
                &constructor_ref
            );
        let fa_metadata =
            object::address_to_object<Metadata>(object::object_address(&test_token));

        (constructor_ref, fa_metadata, mint_ref)
    }
}