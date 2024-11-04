module zion::whitelist {
    use std::simple_map::{Self, SimpleMap};
    use std::signer;
    use aptos_framework::account;

    struct Whitelist has key{
        allowed: SimpleMap<address, bool>
    }

    public entry fun create_module_whitelist(admin: &signer, resource_account_signer: &signer){
        let whitelist = Whitelist{
            allowed: simple_map::new()
        };

        simple_map::add(
            &mut whitelist.allowed, 
            signer::address_of(admin),
            true
        );

        move_to(resource_account_signer, whitelist)
    }

    const ACCOUNT_NOT_ADMIN: u64 = 0;

    public entry fun add_to_whitelist(resource_account_address: address, admin: &signer, new_admin: address) acquires Whitelist {
        assert!(is_in_whitelist(resource_account_address, signer::address_of(admin)), ACCOUNT_NOT_ADMIN);
        let whitelist = borrow_global_mut<Whitelist>(resource_account_address);
        simple_map::add(
            &mut whitelist.allowed, 
            new_admin,
            true
        );
    }

    public entry fun remove_from_whitelist(resource_account_address: address, admin: &signer, old_admin: address) acquires Whitelist {
        assert!(is_in_whitelist(resource_account_address, signer::address_of(admin)), ACCOUNT_NOT_ADMIN);
        let whitelist = borrow_global_mut<Whitelist>(resource_account_address);
        simple_map::upsert(
            &mut whitelist.allowed, 
            old_admin,
            false
        );
    }

    public fun is_in_whitelist(resource_account_address: address, account: address): bool acquires Whitelist {
        let whitelist = borrow_global_mut<Whitelist>(resource_account_address);
        if(simple_map::contains_key(&whitelist.allowed, &account)){
            return *simple_map::borrow(&whitelist.allowed, &account)
        };
        return false
    }

    #[test(aptos_framework = @0x1, admin = @0xCAFE, new_admin = @0x12, normal_person = @0x34)]
    fun test_whitelist(
        aptos_framework: &signer,
        admin: &signer,
        new_admin: &signer,
        normal_person: &signer
    ) acquires Whitelist {
        let (resource_account_signer, signer_cap) = account::create_resource_account(admin, b"TEST");
        let resource_account_address = signer::address_of(&resource_account_signer);
        create_module_whitelist(admin, &resource_account_signer);

        assert!(is_in_whitelist(resource_account_address, signer::address_of(admin)), 1);
        assert!(!is_in_whitelist(resource_account_address, signer::address_of(normal_person)), 2);
        assert!(!is_in_whitelist(resource_account_address, signer::address_of(new_admin)), 3);

        add_to_whitelist(resource_account_address, admin, signer::address_of(new_admin));
        assert!(is_in_whitelist(resource_account_address, signer::address_of(new_admin)), 4);

        remove_from_whitelist(resource_account_address, admin, signer::address_of(new_admin));
        assert!(!is_in_whitelist(resource_account_address, signer::address_of(new_admin)), 5);

        remove_from_whitelist(resource_account_address, admin, signer::address_of(admin));
        assert!(!is_in_whitelist(resource_account_address, signer::address_of(admin)), 6);
    }

    #[test(aptos_framework = @0x1, admin = @0xCAFE, normal_person = @0x34)]
    #[expected_failure(abort_code = ACCOUNT_NOT_ADMIN)]
    fun test_whitelist_not_allowed_to_add(
        aptos_framework: &signer,
        admin: &signer,
        normal_person: &signer
    ) acquires Whitelist {
        let (resource_account_signer, signer_cap) = account::create_resource_account(admin, b"TEST");
        let resource_account_address = signer::address_of(&resource_account_signer);
        create_module_whitelist(admin, &resource_account_signer);

        add_to_whitelist(resource_account_address, normal_person, signer::address_of(normal_person))
    }

    #[test(aptos_framework = @0x1, admin = @0xCAFE, normal_person = @0x34)]
    #[expected_failure(abort_code = ACCOUNT_NOT_ADMIN)]
    fun test_whitelist_not_allowed_to_remove(
        aptos_framework: &signer,
        admin: &signer,
        normal_person: &signer
    ) acquires Whitelist {
        let (resource_account_signer, signer_cap) = account::create_resource_account(admin, b"TEST");
        let resource_account_address = signer::address_of(&resource_account_signer);
        create_module_whitelist(admin, &resource_account_signer);

        remove_from_whitelist(resource_account_address, normal_person, signer::address_of(normal_person))
    }



}