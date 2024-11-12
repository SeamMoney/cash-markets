module zion::crash {

  use std::hash;
  use std::signer;
  use std::vector;
  use zion::liquidity_pool;
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
  
  struct State has key {
    signer_cap: account::SignerCapability,
    current_game: Option<Game>,
    round_start_events: EventHandle<RoundStartEvent>,
    crash_point_calculate_events: EventHandle<CrashPointCalculateEvent>,
    bet_placed_events: EventHandle<BetPlacedEvent>,
    cash_out_events: EventHandle<CashOutEvent>,
    winnings_paid_to_player_events: EventHandle<WinningsPaidToPlayerEvent>
  }

  struct Game has store {
    start_time_ms: u64,
    house_secret_hash: vector<u8>,
    salt_hash: vector<u8>,
    randomness: u64,
    bets: SimpleMap<address, Bet>,
  }

  struct Bet has store {
    player: address, 
    bet_amount: u64, 
    cash_out: Option<u64>
  }

  struct CrashPointCalculateEvent has drop, store {
    house_secret: vector<u8>,
    salt: vector<u8>,
    crash_point: u64
  }

  struct RoundStartEvent has drop, store {
    start_time_micro_seconds: u64,
    house_secret_hash: vector<u8>,
    salt_hash: vector<u8>,
    randomness: u64
  }

  struct BetPlacedEvent has drop, store {
    player: address,
    bet_amount: u64
  }

  struct CashOutEvent has drop, store {
    player: address,
    cash_out: u64
  }

  struct WinningsPaidToPlayerEvent has drop, store {
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
    assert_user_is_module_owner(admin);

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

    let new_game = Game {
      start_time_ms: timestamp::now_microseconds() + COUNTDOWN_MS, 
      house_secret_hash,
      salt_hash,
      bets: simple_map::new(),
      randomness: new_randomness,
      // crash_point_ms: option::none()
    };
    option::fill(&mut state.current_game, new_game);
  }

  public entry fun force_remove_game(
    admin: &signer
  ) acquires State {
    assert_user_is_module_owner(admin);
    let state = borrow_global_mut<State>(get_resource_address());
    let game = option::extract(&mut state.current_game);
    let Game {
      start_time_ms: _,
      house_secret_hash: _,
      salt_hash: _,
      randomness: _,
      bets: game_bets,
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
        cash_out: _
      } = bet;
      cleared_betters = cleared_betters + 1;
    };

    vector::destroy_empty(betters);
    vector::destroy_empty(bets);
  }

  /*
  * Places a bet in the current game of crash. To be used by players via the client.
  * @param player - the signer of the player
  * @param bet_amount - the amount of the bet
  */
  public entry fun place_bet(
    player: &signer,
    bet_amount: u64
  ) acquires State {
    let state = borrow_global_mut<State>(get_resource_address());

    assert!(option::is_some(&state.current_game), ENoGameExists);

    let game_mut_ref = option::borrow_mut(&mut state.current_game);
    assert!(timestamp::now_microseconds() < game_mut_ref.start_time_ms, EGameStarted);

    event::emit_event(
      &mut state.bet_placed_events,
      BetPlacedEvent {
        player: signer::address_of(player),
        bet_amount
      }
    );

    let new_bet = Bet {
      player: signer::address_of(player),
      bet_amount,
      cash_out: option::none()
    };
    simple_map::add(&mut game_mut_ref.bets, signer::address_of(player), new_bet);
    
    let bet_coin = coin::withdraw(player, bet_amount);
    liquidity_pool::put_reserve_coins(bet_coin);
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
    assert_user_is_module_owner(admin);

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
  
    bet.cash_out = option::some(cash_out);
  }

  public entry fun reveal_crashpoint_and_distribute_winnings(
    salted_house_secret: vector<u8>, 
    salt: vector<u8>
  ) acquires State {
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

    let game = option::extract(&mut state.current_game);
    let Game {
      start_time_ms: _,
      house_secret_hash: _,
      salt_hash: _,
      randomness,
      bets: game_bets,
    } = game;
    let (betters, bets) = simple_map::to_vec_pair(game_bets);

    let number_of_bets = vector::length(&betters);
    let cleared_betters = 0;

    let crash_point = calculate_crash_point_with_randomness(randomness, string::utf8(salted_house_secret));

    event::emit_event(
      &mut state.crash_point_calculate_events,
      CrashPointCalculateEvent {
        house_secret: salted_house_secret,
        salt,
        crash_point
      }
    );

    while (cleared_betters < number_of_bets) {
      let better = vector::pop_back(&mut betters);
      let bet = vector::pop_back(&mut bets);

      let winnings = determine_win(bet, crash_point);

      if (winnings > 0) {
        let winnings_coin = liquidity_pool::extract_reserve_coins(winnings);

        coin::deposit(better, winnings_coin);
      };

      event::emit_event(
        &mut state.winnings_paid_to_player_events,
        WinningsPaidToPlayerEvent {
          player: better,
          winnings
        }
      );

      cleared_betters = cleared_betters + 1;
    };

    vector::destroy_empty(betters);
    vector::destroy_empty(bets);
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
    bet: Bet, 
    crash_point: u64
  ): u64 {
    let Bet {
      player: _,
      bet_amount,
      cash_out: player_cash_out_option
    } = bet;

    if (option::is_none(&player_cash_out_option)) {
      0
    } else {
      let player_cash_out = option::extract(&mut player_cash_out_option);
      if (player_cash_out < crash_point) {
        let winnings = bet_amount * player_cash_out / 100; 
        winnings
      } else {
        0
      }
    }
  }

  inline fun assert_user_is_module_owner(user: &signer) {
    assert!(signer::address_of(user) == @zion, EUserIsNotModuleOwner);
  }
}