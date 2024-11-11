module zion::crash {

  use std::hash;
  use std::signer;
  use std::vector;
  use zion::liquidity_pool;
  use zion::whitelist;
  use aptos_framework::coin;
  use aptos_framework::account;
  use aptos_framework::timestamp;
  use aptos_framework::randomness;
  use std::option::{Self, Option};
  use std::string::{Self, String};
  use aptos_framework::string_utils;
  use std::simple_map::{Self, SimpleMap};
  use aptos_framework::aptos_coin::{AptosCoin};
  use aptos_framework::event::{Self, EventHandle};
  use aptos_std::type_info::{Self, TypeInfo, type_name};

  use std::debug::print;
  
  const SEED: vector<u8> = b"zion-crash";
  const MAX_CRASH_POINT: u128 = 340282366920938463463374607431768211455; // 2^64 - 1
  const COUNTDOWN_MS: u64 = 20 * 1_000_000;

  const EUserIsNotModuleOwner: u64 = 1;
  const ENoGameExists: u64 = 2;
  const EGameNotStarted: u64 = 3;
  const EGameStarted: u64 = 4;
  const ENoBetToCashOut: u64 = 5;
  const EGameAlreadyExists: u64 = 6;
  const EHashesDoNotMatch: u64 = 7;
  const EGameHasntEnded: u64 = 8;
  const ENotAllWinningsDistributed: u64 = 9;
  
  struct State has key {
    signer_cap: account::SignerCapability,
    current_game: Option<Game>,
    round_start_events: EventHandle<RoundStartEvent>,
    crash_point_calculate_events: EventHandle<CrashPointCalculateEvent>,
    bet_placed_events: EventHandle<BetPlacedEvent>,
    cash_out_events: EventHandle<CashOutEvent>,
    winnings_paid_to_player_events: EventHandle<WinningsPaidToPlayerEvent>
  }

  struct Game has store, drop {
    start_time_ms: u64,
    house_secret_hash: vector<u8>,
    salt_hash: vector<u8>,
    randomness: u64,
    bets: SimpleMap<address, Bet>,
    crash_point: Option<u64>
  }

  struct Bet has store, drop {
    player: address, 
    bet_amount: u64, 
    cash_out: Option<u64>,
    token_address_as_string: String
  }

  #[event]
  struct CrashPointCalculateEvent has drop, store {
    house_secret: vector<u8>,
    salt: vector<u8>,
    crash_point: u64
  }

  #[event]
  struct RoundStartEvent has drop, store {
    start_time_micro_seconds: u64,
    house_secret_hash: vector<u8>,
    salt_hash: vector<u8>,
    randomness: u64
  }

  #[event]
  struct BetPlacedEvent has drop, store {
    token: String,
    player: address,
    bet_amount: u64
  }

  #[event]
  struct CashOutEvent has drop, store {
    player: address,
    cash_out: u64
  }

  #[event]
  struct WinningsPaidToPlayerEvent has drop, store {
    token: String,
    player: address,
    winnings: u64
  }

  /*
  * Initializes the module by creating the module's resource account and initializing the state 
  * resource. 
  * @param admin - the signer of the admin account
  */
  fun init_module(admin: &signer) {
    let (resource_account_signer, signer_cap) = account::create_resource_account(admin, SEED);

    //This creates the whitelist for both crash and liquidity pool.
    if(!whitelist::whitelist_exists(signer::address_of(&resource_account_signer))){
      whitelist::create_module_whitelist(&resource_account_signer, admin); 
    };

    coin::register<AptosCoin>(&resource_account_signer);

    move_to<State>(
      &resource_account_signer,
      State {
        signer_cap: signer_cap,
        current_game: option::none(),
        round_start_events: account::new_event_handle(&resource_account_signer),
        crash_point_calculate_events: account::new_event_handle(&resource_account_signer),
        bet_placed_events: account::new_event_handle(&resource_account_signer),
        cash_out_events: account::new_event_handle(&resource_account_signer),
        winnings_paid_to_player_events: account::new_event_handle(&resource_account_signer)
      }
    );
  }

  /*
  * Starts a new game of crash. This is to be called by the server via the admin account. The server
  * will generate a house secret and salt, hash them, and pass the hashes to this function as proof 
  * that the server generates the house secret and salt fairly and before the ranomness is revealed.
  * @param admin - the signer of the admin account
  * @param start_time_ms - the time in milliseconds when the game will start
  * @param house_secret_hash - the hash of the house secret
  * @param salt_hash - the hash of the salt
  */
  #[randomness]
  entry fun start_game(
    admin: &signer, 
    house_secret_hash: vector<u8>, 
    salt_hash: vector<u8>
  ) acquires State {
    whitelist::assert_is_admin(get_resource_address(), admin);

    let state = borrow_global_mut<State>(get_resource_address());

    assert!(
      option::is_none(&state.current_game),
      EGameAlreadyExists
    );

    let new_randomness = randomness::u64_integer();

    print(&house_secret_hash);

    event::emit_event(
      &mut state.round_start_events,
      RoundStartEvent {
        start_time_micro_seconds: timestamp::now_microseconds() + COUNTDOWN_MS,
        house_secret_hash,
        salt_hash,
        randomness: new_randomness
      }
    );

    event::emit(
      RoundStartEvent {
        start_time_micro_seconds: timestamp::now_microseconds() + COUNTDOWN_MS,
        house_secret_hash,
        salt_hash,
        randomness: new_randomness
      }
    );

    let new_game = Game {
      start_time_ms: timestamp::now_microseconds() + COUNTDOWN_MS, 
      house_secret_hash,
      salt_hash,
      bets: simple_map::new(),
      randomness: new_randomness,
      crash_point: option::none()
    };
    option::fill(&mut state.current_game, new_game);
  }

  public entry fun force_remove_game(
    admin: &signer
  ) acquires State {
    whitelist::assert_is_admin(get_resource_address(), admin);
    let state = borrow_global_mut<State>(get_resource_address());
    let game = option::extract(&mut state.current_game);
    let Game {
      start_time_ms: _,
      house_secret_hash: _,
      salt_hash: _,
      randomness: _,
      bets: game_bets,
      crash_point: _
    } = game;

    let (betters, bets) = simple_map::to_vec_pair(game_bets);

    let number_of_bets = vector::length(&betters);
    let cleared_betters = 0;

    while (cleared_betters < number_of_bets) {
      vector::pop_back(&mut betters);
      let bet = vector::pop_back(&mut bets);
      let Bet {
        player: _,
        bet_amount: _,
        cash_out: _,
        token_address_as_string: _
      } = bet;
      cleared_betters = cleared_betters + 1;
    };

    vector::destroy_empty(betters);
    vector::destroy_empty(bets);
  }

  const E_TOKEN_IS_NOT_TOKEN_TYPE: u64 = 0;

  /*
  * Places a bet in the current game of crash. To be used by players via the client.
  * @param player - the signer of the player
  * @param bet_amount - the amount of the bet
  */
  public entry fun place_bet<BettingCoinType, LPCoinType>(
    player: &signer,
    bet_amount: u64,
    token_addr_as_string: String
  ) acquires State {

    let betting_coin_as_string = type_info::type_name<BettingCoinType>();

    let state = borrow_global_mut<State>(get_resource_address());

    assert!(option::is_some(&state.current_game), ENoGameExists);

    let game_mut_ref = option::borrow_mut(&mut state.current_game);
    assert!(timestamp::now_microseconds() < game_mut_ref.start_time_ms, EGameStarted);

    event::emit_event(
      &mut state.bet_placed_events,
      BetPlacedEvent {
        token: betting_coin_as_string,
        player: signer::address_of(player),
        bet_amount
      }
    );

    event::emit(
      BetPlacedEvent {
        token: betting_coin_as_string,
        player: signer::address_of(player),
        bet_amount
      }
    );

    let new_bet = Bet {
      player: signer::address_of(player),
      bet_amount,
      cash_out: option::none(),
      token_address_as_string: betting_coin_as_string
    };
    simple_map::add(&mut game_mut_ref.bets, signer::address_of(player), new_bet);
    
    let bet_coin = coin::withdraw<BettingCoinType>(player, bet_amount);
    liquidity_pool::put_reserve_coins<BettingCoinType, LPCoinType>(bet_coin);
  }


  public entry fun place_bet_fa<ReserveTokenType: key>(
    player: &signer,
    bet_amount: u64,
  ) acquires State {

    let bet_identifier = type_info::type_name<ReserveTokenType>();

    let state = borrow_global_mut<State>(get_resource_address());

    assert!(option::is_some(&state.current_game), ENoGameExists);

    let game_mut_ref = option::borrow_mut(&mut state.current_game);
    assert!(timestamp::now_microseconds() < game_mut_ref.start_time_ms, EGameStarted);

    event::emit_event(
      &mut state.bet_placed_events,
      BetPlacedEvent {
        token: type_info::type_name<ReserveTokenType>(),
        player: signer::address_of(player),
        bet_amount
      }
    );

    event::emit(
      BetPlacedEvent {
        token: type_info::type_name<ReserveTokenType>(),
        player: signer::address_of(player),
        bet_amount
      }
    );

    let new_bet = Bet {
      player: signer::address_of(player),
      bet_amount,
      cash_out: option::none(),
      token_address_as_string: bet_identifier
    };
    simple_map::add(&mut game_mut_ref.bets, signer::address_of(player), new_bet);
    
    liquidity_pool::put_reserve_coins_fa<ReserveTokenType>(player, bet_amount);
  }


  /*
  * Allows a player to cash out their bet in the current game of crash. To be used by players via the client.
  * @param player - the signer of the player
  */
  public entry fun cash_out(
    admin: &signer,
    player: address,
    cash_out: u64
  ) acquires State {
    whitelist::assert_is_admin(get_resource_address(), admin);

    let state = borrow_global_mut<State>(get_resource_address());
    assert!(option::is_some(&state.current_game), ENoGameExists);

    let game_mut_ref = option::borrow_mut(&mut state.current_game);
    assert!(timestamp::now_microseconds() > game_mut_ref.start_time_ms, EGameNotStarted);

    let bet = simple_map::borrow_mut(&mut game_mut_ref.bets, &player);
    assert!(option::is_none(&bet.cash_out), ENoBetToCashOut);

    event::emit_event(
      &mut state.cash_out_events,
      CashOutEvent {
        player: player,
        cash_out
      }
    );

    event::emit(
      CashOutEvent {
        player: player,
        cash_out
      }
    );
  
    bet.cash_out = option::some(cash_out);
  }

  public entry fun reveal_crashpoint(
    admin: &signer,
    salted_house_secret: vector<u8>, 
    salt: vector<u8>
  ) acquires State {
    whitelist::assert_is_admin(get_resource_address(), admin);
    let state = borrow_global_mut<State>(get_resource_address());
    assert!(option::is_some(&state.current_game), ENoGameExists);

    let game_mut_ref = option::borrow_mut(&mut state.current_game);
    assert!(timestamp::now_microseconds() >= game_mut_ref.start_time_ms, EGameNotStarted);

    assert!(
      verify_hashes(
        salted_house_secret, 
        salt, 
        &game_mut_ref.house_secret_hash, 
        &game_mut_ref.salt_hash
      ), 
      EHashesDoNotMatch
    );

    let game = option::borrow_mut(&mut state.current_game);
    let crash_point = calculate_crash_point_with_randomness(game.randomness, string::utf8(salted_house_secret));

    game.crash_point = option::some(crash_point);

    event::emit_event(
      &mut state.crash_point_calculate_events,
      CrashPointCalculateEvent {
        house_secret: salted_house_secret,
        salt,
        crash_point
      }
    );

    event::emit(
      CrashPointCalculateEvent {
        house_secret: salted_house_secret,
        salt,
        crash_point
      }
    );
  }

    public entry fun distribute_winnings<BettingCoinType, LPCoinType>() acquires State {
        let state = borrow_global_mut<State>(get_resource_address());
        assert!(option::is_some(&state.current_game), ENoGameExists);

        let game_mut_ref = option::borrow_mut(&mut state.current_game);
        assert!(timestamp::now_microseconds() >= game_mut_ref.start_time_ms, EGameNotStarted);

        let betting_coin_as_string = type_info::type_name<BettingCoinType>();

        let game = option::borrow_mut(&mut state.current_game);
        
        assert!(option::is_some(&game.crash_point), EGameHasntEnded);
        let crash_point = *option::borrow(&game.crash_point);

        let betters = simple_map::keys(&game.bets);

        let i = 0;

        while (i < vector::length(&betters)) {
            let better = *vector::borrow(&mut betters, i);
            let bet = simple_map::borrow_mut(&mut game.bets, &better);

            if(betting_coin_as_string == bet.token_address_as_string){
                let winnings = determine_win(bet, crash_point);

                if (winnings > 0) {
                    let winnings_coin = liquidity_pool::extract_reserve_coins<BettingCoinType, LPCoinType>(winnings);
                    coin::deposit<BettingCoinType>(better, winnings_coin);
                };

                simple_map::remove(&mut game.bets, &better);

                event::emit_event(
                    &mut state.winnings_paid_to_player_events,
                    WinningsPaidToPlayerEvent {
                      token: type_info::type_name<BettingCoinType>(),
                      player: better,
                      winnings
                    }
                );

                event::emit(
                  WinningsPaidToPlayerEvent {
                      token: type_info::type_name<BettingCoinType>(),
                      player: better,
                      winnings
                    }
                );
            };

            i = i + 1;
        };
    }



    public entry fun distribute_winnings_fa<ReserveTokenType: key>() acquires State {
        let state = borrow_global_mut<State>(get_resource_address());
        assert!(option::is_some(&state.current_game), ENoGameExists);

        let game_mut_ref = option::borrow_mut(&mut state.current_game);
        assert!(timestamp::now_microseconds() >= game_mut_ref.start_time_ms, EGameNotStarted);

        let bet_identifier = type_info::type_name<ReserveTokenType>();

        let game = option::borrow_mut(&mut state.current_game);
        
        assert!(option::is_some(&game.crash_point), EGameHasntEnded);
        let crash_point = *option::borrow(&game.crash_point);

        let betters = simple_map::keys(&game.bets);

        let i = 0;

        while (i < vector::length(&betters)) {
            let better = *vector::borrow(&mut betters, i);
            let bet = simple_map::borrow_mut(&mut game.bets, &better);

            if(bet_identifier == bet.token_address_as_string){
                let winnings = determine_win(bet, crash_point);

                if (winnings > 0) {
                    liquidity_pool::extract_reserve_coins_fa<ReserveTokenType>(winnings, better);
                };

                simple_map::remove(&mut game.bets, &better);

                event::emit_event(
                    &mut state.winnings_paid_to_player_events,
                    WinningsPaidToPlayerEvent {
                      token: type_info::type_name<ReserveTokenType>(),
                      player: better,
                      winnings
                    }
                );

                event::emit(
                  WinningsPaidToPlayerEvent {
                    token: type_info::type_name<ReserveTokenType>(),
                    player: better,
                    winnings
                  }
                )
            };

            i = i + 1;
        };
    }


    public entry fun shutdown_game() acquires State {
        let state = borrow_global_mut<State>(get_resource_address());
        assert!(option::is_some(&state.current_game), ENoGameExists);

        let game_mut_ref = option::borrow_mut(&mut state.current_game);
        assert!(option::is_some(&game_mut_ref.crash_point), EGameHasntEnded);
        assert!(timestamp::now_microseconds() >= game_mut_ref.start_time_ms, EGameNotStarted);

        let game = option::borrow_mut(&mut state.current_game);
        assert!(vector::length(&simple_map::keys(&game.bets)) > 0, ENotAllWinningsDistributed);
        option::extract(&mut state.current_game);
    }

  

  fun calculate_crash_point_with_randomness(
    randomness: u64, 
    house_secret: String
  ): u64 {
    let randomness_string = string_utils::to_string(&randomness);
    string::append(&mut randomness_string, house_secret);

    let hash = hash::sha3_256(*string::bytes(&randomness_string));

    if (parse_hex(hash, false) % 33 == 0) {
      0
    } else {
      vector::trim(&mut hash, 7);
      let value = parse_hex(hash, true);
      let e = pow(2, 52);
      let res = (((100 * e - value) / (e - value)) as u64);
      if (res == 1) {
        0
      } else {
        res
      }
    }
  }

  fun parse_hex(hex: vector<u8>, ignore_first: bool): u256 {
    let exponent = 0;
    let sum = 0;

    while (vector::length(&hex) > 0) {
      if (ignore_first && exponent == 0) {
        let byte = (vector::pop_back(&mut hex) as u256);
        sum = sum + (byte / 16) * pow(16, exponent);
        exponent = exponent + 1;
        continue
      };
      let byte = (vector::pop_back(&mut hex) as u256);
      sum = sum + (byte % 16) * pow(16, exponent) + (byte / 16) * pow(16, exponent + 1);
      exponent = exponent + 2;
    };

    sum
  }

  public fun pow(n: u256, e: u256): u256 {
    if (e == 0) {
        1
    } else {
        let p = 1;
        while (e > 1) {
            if (e % 2 == 1) {
                p = p * n;
            };
            e = e / 2;
            n = n * n;
        };
        p * n
    }
  }

  /* 
    Create and return the address of the module's resource account
    @return - address of the module's resource account
  */ 
  inline fun get_resource_address(): address {
    account::create_resource_address(&@zion, SEED)
  }

  inline fun verify_hashes(
    house_secret: vector<u8>, 
    salt: vector<u8>, 
    house_secret_hash: &vector<u8>,
    salt_hash: &vector<u8>
  ): bool {

    let actual_house_secret_hash = hash::sha3_256(house_secret);
    let actual_salt_hash = hash::sha3_256(salt);

    &actual_house_secret_hash == house_secret_hash && &actual_salt_hash == salt_hash
  }

  inline fun determine_win(
    bet: &mut Bet, 
    crash_point: u64
  ): u64 {

    if (option::is_none(&bet.cash_out)) {
      0
    } else {
      let player_cash_out = option::extract(&mut bet.cash_out);
      if (player_cash_out < crash_point) {
        let winnings = (bet.bet_amount) * player_cash_out / 100; 
        winnings
      } else {
        0
      }
    }
  }
}