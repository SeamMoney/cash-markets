module zion::z_apt {
    
  use std::signer;
  use std::string;
  use aptos_framework::coin;
  use aptos_framework::account;

  const SEED: vector<u8> = b"zion-apt";
  const COIN_DECIMALS: u8 = 8;

  const EUserIsNotModuleOwner: u64 = 101;

  struct ZAPT {}

  struct AdminCap has key {}

  struct State has key {
    signer_cap: account::SignerCapability,
    aptos_coin_mint_cap: coin::MintCapability<ZAPT>,
    aptos_coin_burn_cap: coin::BurnCapability<ZAPT>
  }

  fun init_module(admin: &signer) {
    let (resource_account_signer, signer_cap) = account::create_resource_account(admin, SEED);

    let (burn_cap, freeze_cap, mint_cap) = coin::initialize<ZAPT>(
      admin, 
      string::utf8(b"Zion Aptos Coin"),
      string::utf8(b"zAPT"),
      COIN_DECIMALS,
      true
    );
    coin::destroy_freeze_cap(freeze_cap);

    move_to<State>(
      &resource_account_signer,
      State {
        signer_cap: signer_cap,
        aptos_coin_mint_cap: mint_cap,
        aptos_coin_burn_cap: burn_cap
      }
    );

    coin::register<ZAPT>(&resource_account_signer);
  }

  public entry fun mint(
    admin: &signer,
    amount: u64, 
    recipient: address
  ) acquires State {
    assert_user_is_module_owner(admin);
    let state = borrow_global_mut<State>(get_resource_address());
    let minted_coin = coin::mint(amount, &state.aptos_coin_mint_cap);
    coin::deposit(recipient, minted_coin);
  }

  public entry fun register(recipient: &signer) {
    coin::register<ZAPT>(recipient);
  }

  public entry fun burn(
    owner: &signer,
    amount: u64
  ) acquires State {
    let state = borrow_global_mut<State>(get_resource_address());
    let coin_to_burn = coin::withdraw(owner, amount);
    coin::burn(coin_to_burn, &state.aptos_coin_burn_cap);
  }

  /* 
    Create and return the address of the module's resource account
    @return - address of the module's resource account
  */ 
  inline fun get_resource_address(): address {
    account::create_resource_address(&@zion, SEED)
  }

  inline fun assert_user_is_module_owner(user: &signer) {
    assert!(signer::address_of(user) == @zion, EUserIsNotModuleOwner);
  }

}