module zion::liquidity_pool {

  use std::string::{Self, String};
  use std::signer;
  use std::vector::{Self};
  use std::object::{Self, Object};
  use aptos_std::type_info::{Self, type_name};
  use aptos_framework::event::{Self};
  use aptos_framework::option;
  use aptos_framework::math128;
  use aptos_framework::account;
  use aptos_framework::object::{ConstructorRef};
  use aptos_framework::coin::{Self, Coin};
  use aptos_framework::primary_fungible_store::{Self, create_primary_store_enabled_fungible_asset};
  use aptos_framework::fungible_asset::{Self, MintRef, TransferRef, BurnRef, FungibleStore, Metadata};

  use zion::z_apt::ZAPT;
  use zion::whitelist;

  friend zion::crash;

  #[test_only]
  use aptos_framework::fungible_asset::{generate_mint_ref, generate_burn_ref, generate_transfer_ref};
  #[test_only]
  use aptos_framework::event::{emitted_events};

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

  struct LiquidityPoolFA<phantom ResMeta> has key {
    reserve_metadata: Object<ResMeta>,
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
    // lock_events: event::EventHandle<LockEvent>,
    new_fa_pool_events: event::EventHandle<NewFALPEvent>,
    new_pool_events: event::EventHandle<NewLPEvent>
  }

  #[event]
  struct DepositEvent has drop, store {
    token: String,
    address: address, 
    amount: u64,
    lp_coin_amount: u64
  }

  #[event]
  struct WithdrawEvent has drop, store {
    token: String,
    address: address, 
    amount: u64,
    lp_coin_amount: u64
  }

  #[event]
  struct ExtractEvent has drop, store {
    token: String,
    amount: u64
  }

  #[event]
  struct PutEvent has drop, store {
    token: String,
    amount: u64
  }

  // #[event]
  // struct LockEvent has drop, store {

  //   address: address, 
  //   lp_coin_amount: u64
  // }

  #[event]
  struct NewFALPEvent has drop, store {
    reserve_metadata: address,
    lp_metadata: address
  }

  #[event]
  struct NewLPEvent has drop, store {
    reserve_token_type: String,
    lp_token_type: String
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
        // lock_events: account::new_event_handle(&resource_account_signer),
        new_fa_pool_events: account::new_event_handle(&resource_account_signer),
        new_pool_events: account::new_event_handle(&resource_account_signer),
      }
    );
  }

  public entry fun init_fa_LP_pool<ResMeta: key>(
    admin: &signer,
    reserve_metadata: Object<ResMeta>,
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

    let lp_metadata = object::object_from_constructor_ref<Metadata>(constructor_ref);

    move_to(
      &resource_account_signer,
      LiquidityPoolFA {
        reserve_metadata,
        lp_metadata,
        lp_mint_ref,
        lp_burn_ref
      }
    );

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).new_fa_pool_events,
      NewFALPEvent {
        reserve_metadata: object::object_address(&reserve_metadata),
        lp_metadata: object::object_address(&lp_metadata)
      }
    );

    event::emit(
      NewFALPEvent {
        reserve_metadata: object::object_address(&reserve_metadata),
        lp_metadata: object::object_address(&lp_metadata)
      });
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

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).new_pool_events,
      NewLPEvent {
        reserve_token_type: type_name<BettingCoinType>(),
        lp_token_type: type_name<LPCoinType>()
      }
    );

    event::emit(
      NewLPEvent {
        reserve_token_type: type_name<BettingCoinType>(),
        lp_token_type: type_name<LPCoinType>()
      }
    )
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
        token: type_info::type_name<BettingCoinType>(),
        address: signer::address_of(supplier),
        amount: supply_amount,
        lp_coin_amount: amount_lp_coins_to_mint
      });

    event::emit(
      DepositEvent {
        token: type_info::type_name<BettingCoinType>(),
        address: signer::address_of(supplier),
        amount: supply_amount,
        lp_coin_amount: amount_lp_coins_to_mint
      }
    );
    

    let supplied_coin = coin::withdraw(supplier, supply_amount);
    coin::merge(&mut liquidity_pool.reserve_coin, supplied_coin);

    let lp_coin = coin::mint(amount_lp_coins_to_mint, &liquidity_pool.lp_coin_mint_cap);
    coin::register<LPCoinType>(supplier); //May not work, may need to move to managed_coin::register
    coin::deposit(signer::address_of(supplier), lp_coin);
  }

  public entry fun supply_fa_liquidity<ResMeta: key>(
    supplier: &signer,
    supply_amount: u64,
  ) acquires LiquidityPoolFA, State {
    let liquidity_pool = borrow_global_mut<LiquidityPoolFA<ResMeta>>(get_resource_address());

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
        token: type_info::type_name<ResMeta>(), 
        address: signer::address_of(supplier),
        amount: supply_amount,
        lp_coin_amount: amount_lp_coins_to_mint
      });

      event::emit(
        DepositEvent {
          token: type_info::type_name<ResMeta>(),
          address: signer::address_of(supplier),
          amount: supply_amount,
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
        token: type_info::type_name<BettingCoinType>(),
        address: signer::address_of(supplier),
        amount: amount_reserve_to_remove,
        lp_coin_amount
      }
    );

    event::emit(
      WithdrawEvent {
        token: type_info::type_name<BettingCoinType>(),
        address: signer::address_of(supplier),
        amount: amount_reserve_to_remove,
        lp_coin_amount
      }
    );

    let lp_coin_to_remove = coin::withdraw(supplier, lp_coin_amount);
    coin::burn(lp_coin_to_remove, &liquidity_pool.lp_coin_burn_cap);
  }

  public entry fun remove_fa_liquidity<ResMeta: key>(
    supplier: &signer, 
    lp_coin_amount: u64
  ) acquires LiquidityPoolFA, State {
    let liquidity_pool = borrow_global_mut<LiquidityPoolFA<ResMeta>>(get_resource_address());

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
        token: type_info::type_name<ResMeta>(),
        address: signer::address_of(supplier),
        amount: amount_reserve_to_remove,
        lp_coin_amount
      });

    event::emit(
      WithdrawEvent {
        token: type_info::type_name<ResMeta>(),
        address: signer::address_of(supplier),
        amount: amount_reserve_to_remove,
        lp_coin_amount
      }
    );

    primary_fungible_store::burn(&liquidity_pool.lp_burn_ref, signer::address_of(supplier), lp_coin_amount)
  }

  public(friend) fun extract_reserve_coins<BettingCoinType, LPCoinType>(
    amount: u64
  ): Coin<BettingCoinType> acquires LiquidityPool, State {
    let liquidity_pool = borrow_global_mut<LiquidityPool<BettingCoinType, LPCoinType>>(get_resource_address());

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).extract_events,
      ExtractEvent {
        token: type_info::type_name<BettingCoinType>(),
        amount
      }
    );

    event::emit(
      ExtractEvent {
        token: type_info::type_name<BettingCoinType>(),
        amount
      }
    );

    coin::extract(&mut liquidity_pool.reserve_coin, amount)
  }

  public(friend) fun extract_reserve_coins_fa<ResMeta: key>(
    amount: u64,
    to: address
  ) acquires LiquidityPoolFA, State {
    let liquidity_pool = borrow_global_mut<LiquidityPoolFA<ResMeta>>(get_resource_address());

    let reserve_metadata = liquidity_pool.reserve_metadata;
    let lp_metadata = liquidity_pool.lp_metadata;

    let pool_state = borrow_global<State>(get_resource_address());
    let resource_account_signer = account::create_signer_with_capability(&pool_state.signer_cap);

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).extract_events,
      ExtractEvent {
        token: type_info::type_name<ResMeta>(),
        amount
      }
    );

    event::emit(
      ExtractEvent {
        token: type_info::type_name<ResMeta>(),
        amount
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
        token: type_info::type_name<BettingCoinType>(),
        amount: coin::value(&coin)
      }
    );

    event::emit(
      PutEvent {
        token: type_info::type_name<BettingCoinType>(),
        amount: coin::value(&coin)
      }
    );

    coin::merge(&mut liquidity_pool.reserve_coin, coin);
  }

  public fun put_reserve_coins_fa<ResMeta: key>(
    from: &signer,
    amount: u64
  ) acquires LiquidityPoolFA, State {
    let liquidity_pool = borrow_global_mut<LiquidityPoolFA<ResMeta>>(get_resource_address());

    let reserve_metadata = liquidity_pool.reserve_metadata;
    let lp_metadata = liquidity_pool.lp_metadata;

    let pool_state = borrow_global<State>(get_resource_address());

    event::emit_event(
      &mut borrow_global_mut<State>(get_resource_address()).put_events,
      PutEvent {
        token: type_info::type_name<ResMeta>(),
        amount
      }
    );

    event::emit(
      PutEvent {
        token: type_info::type_name<ResMeta>(),
        amount
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
  public fun get_pool_supply_fa<FAType: key>(): u64 acquires LiquidityPoolFA {
    let liquidity_pool = borrow_global<LiquidityPoolFA<FAType>>(get_resource_address());
    primary_fungible_store::balance(get_resource_address(), liquidity_pool.reserve_metadata)
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
    struct TestToken1{}
    #[test_only]
    struct LPToken1{}
    #[test_only]
    struct TestToken2{}
    #[test_only]
    struct LPToken2{}

    #[test_only]
    struct FALiqType{}

    #[test(admin = @zion, better = @0x123)]
    #[expected_failure(abort_code = 0)]
    fun test_cant_create_liq_pool(admin: signer, better: signer) acquires State {
      init_module(&admin);
      init_LP_pool<TestToken1, LPToken1>(&better, string::utf8(b"LpToken1"), string::utf8(b"LP1"), 8);
    }

    #[test(admin = @zion)]
    fun test_create_liquidity_pool(admin: signer) acquires State, LiquidityPool {
      account::create_account_for_test(signer::address_of(&admin));
      let admin_addr = signer::address_of(&admin);
      init_module(&admin);

      let test_amount: u64 = 150;

      let supply_amount_1 = 50;
      let expected_lp_1 = 50;

      let supply_amount_2 = 50;
      let expected_lp_2 = 50;

      let supply_amount_3 = 50;
      let expected_lp_3 = 16;

      let put_reserve_amount = 200;

      let remove_amount_1 = 50;
      let expected_return = 150;
      
      let extract_amount = 200;
      

      let (burn_cap, freeze_cap, mint_cap) = coin::initialize<TestToken1>(&admin, string::utf8(b"TestToken1"), string::utf8(b"TT1"), 8, false);
      coin::register<TestToken1>(&admin);
      let c = coin::mint(test_amount, &mint_cap);
      coin::deposit(admin_addr, c);

      assert!(coin::balance<TestToken1>(admin_addr) == test_amount, 0);

      //Init Pool
      init_LP_pool<TestToken1, LPToken1>(&admin, string::utf8(b"LpToken1"), string::utf8(b"LP1"), 8);

      //Supply 1
      supply_liquidity<TestToken1, LPToken1>(&admin, supply_amount_1);
      assert!(coin::balance<TestToken1>(admin_addr) == test_amount - supply_amount_1, 0);
      assert!(coin::balance<LPToken1>(admin_addr) == expected_lp_1, 0);

      //Supply2
      supply_liquidity<TestToken1, LPToken1>(&admin, supply_amount_2);
      assert!(coin::balance<TestToken1>(admin_addr) == test_amount - supply_amount_1 - supply_amount_2, 0);
      assert!(coin::balance<LPToken1>(admin_addr) == expected_lp_2 + expected_lp_1, 0);

      //Put Into Reserve
      let c = coin::mint(put_reserve_amount, &mint_cap);
      put_reserve_coins<TestToken1, LPToken1>(c);

      //Supply3
      supply_liquidity<TestToken1, LPToken1>(&admin, supply_amount_3);
      assert!(coin::balance<TestToken1>(admin_addr) == test_amount - supply_amount_1 - supply_amount_2 - supply_amount_3, 0);
      assert!(coin::balance<LPToken1>(admin_addr) == expected_lp_2 + expected_lp_1 + expected_lp_3, 0);

      //Remove 1
      remove_liquidity<TestToken1, LPToken1>(&admin, remove_amount_1);
      assert!(coin::balance<TestToken1>(admin_addr) == test_amount - supply_amount_1 - supply_amount_2 - supply_amount_3 + expected_return, 0);
      assert!(coin::balance<LPToken1>(admin_addr) == expected_lp_2 + expected_lp_1 + expected_lp_3 - remove_amount_1, 0);

      //Extract
      let c = extract_reserve_coins<TestToken1, LPToken1>(extract_amount);
      coin::deposit(admin_addr, c);
      assert!(coin::balance<TestToken1>(admin_addr) == test_amount - supply_amount_1 - supply_amount_2 - supply_amount_3 + expected_return + extract_amount, 0);
      assert!(get_pool_supply<TestToken1, LPToken1>() == supply_amount_1 + supply_amount_2 + supply_amount_3 + put_reserve_amount - expected_return - extract_amount, 0);

      coin::destroy_freeze_cap(freeze_cap);
      coin::destroy_mint_cap(mint_cap);
      coin::destroy_burn_cap(burn_cap);
    }

    struct FAType has key {}

    #[test_only]
    public fun create_test_fa_token(creator: &signer): (ConstructorRef, Object<FAType>) {
        account::create_account_for_test(signer::address_of(creator));
        let creator_ref = object::create_named_object(creator, b"TEST");
        let object_signer = object::generate_signer(&creator_ref);
        move_to(&object_signer, FAType {});

        let token = object::object_from_constructor_ref<FAType>(&creator_ref);
        (creator_ref, token)
    }

    #[test_only]
    public fun init_test_metadata_with_primary_store_enabled(
        constructor_ref: &ConstructorRef
    ): (MintRef, TransferRef, BurnRef) {
        create_primary_store_enabled_fungible_asset(
            constructor_ref,
            option::none(), // max supply
            string::utf8(b"TEST COIN"),
            string::utf8(b"@T"),
            0,
            string::utf8(b"http://example.com/icon"),
            string::utf8(b"http://example.com"),
        );
        let mint_ref = generate_mint_ref(constructor_ref);
        let burn_ref = generate_burn_ref(constructor_ref);
        let transfer_ref = generate_transfer_ref(constructor_ref);
        (mint_ref, transfer_ref, burn_ref)
    }

    #[test(admin = @zion)]
    fun test_create_fa_liquidity_pool(admin: signer) acquires State, LiquidityPoolFA {
      account::create_account_for_test(signer::address_of(&admin));
      let admin_addr = signer::address_of(&admin);
      init_module(&admin);

      let test_amount: u64 = 150;

      let supply_amount_1 = 50;
      let expected_lp_1 = 50;

      let supply_amount_2 = 50;
      let expected_lp_2 = 50;

      let supply_amount_3 = 50;
      let expected_lp_3 = 16;

      let put_reserve_amount = 200;

      let remove_amount_1 = 50;
      let expected_return = 150;
      
      let extract_amount = 200;
      
      let (creator_ref, metadata) = create_test_fa_token(&admin);
      let (mint_ref, transfer_ref, burn_ref) = init_test_metadata_with_primary_store_enabled(&creator_ref);
      primary_fungible_store::mint(&mint_ref, admin_addr, test_amount);

      assert!(primary_fungible_store::balance(admin_addr, metadata) == test_amount, 0);

      // //Init Pool
      init_fa_LP_pool<FAType>(
        &admin,
        metadata,
        string::utf8(b"FA_LP_Token"),
        string::utf8(b"FALPT"),
        8,
        string::utf8(b"example.com"),
        string::utf8(b"example.com"),
      );

      // let state = borrow_global<State>(get_resource_address());
      let events = emitted_events<NewFALPEvent>();
      let new_fa_pool_event = vector::borrow(&events, 0);

      let reserve_metadata = object::address_to_object<FAType>(new_fa_pool_event.reserve_metadata);
      let lp_metadata = object::address_to_object<Metadata>(new_fa_pool_event.lp_metadata);

      // //Supply 1
      supply_fa_liquidity<FAType>(&admin, supply_amount_1);
      assert!(primary_fungible_store::balance(admin_addr, reserve_metadata) == test_amount - supply_amount_1, 0);
      assert!(primary_fungible_store::balance(admin_addr, lp_metadata) == expected_lp_1, 0);

      // //Supply2
      supply_fa_liquidity<FAType>(&admin, supply_amount_2);
      assert!(primary_fungible_store::balance(admin_addr, reserve_metadata) == test_amount - supply_amount_1 - supply_amount_2, 0);
      assert!(primary_fungible_store::balance(admin_addr, lp_metadata) == expected_lp_2 + expected_lp_1, 0);

      // //Put Into Reserve
      primary_fungible_store::mint(&mint_ref, admin_addr, put_reserve_amount);
      put_reserve_coins_fa<FAType>(&admin, put_reserve_amount);

      // //Supply3
      supply_fa_liquidity<FAType>(&admin, supply_amount_3);
      assert!(primary_fungible_store::balance(admin_addr, reserve_metadata) == test_amount - supply_amount_1 - supply_amount_2 - supply_amount_3, 0);
      assert!(primary_fungible_store::balance(admin_addr, lp_metadata) == expected_lp_2 + expected_lp_1 + expected_lp_3, 0);

      // //Remove 1
      remove_fa_liquidity<FAType>(&admin, remove_amount_1);
      assert!(primary_fungible_store::balance(admin_addr, reserve_metadata) == test_amount - supply_amount_1 - supply_amount_2 - supply_amount_3 + expected_return, 0);
      assert!(primary_fungible_store::balance(admin_addr, lp_metadata) == expected_lp_2 + expected_lp_1 + expected_lp_3 - remove_amount_1, 0);

      // //Extract
      extract_reserve_coins_fa<FAType>(extract_amount, admin_addr);
      assert!(primary_fungible_store::balance(admin_addr, reserve_metadata) == test_amount - supply_amount_1 - supply_amount_2 - supply_amount_3 + expected_return + extract_amount, 0);
      assert!(get_pool_supply_fa<FAType>() == supply_amount_1 + supply_amount_2 + supply_amount_3 + put_reserve_amount - expected_return - extract_amount, 0);
    }
}