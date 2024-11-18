import { AptosAccount, AptosClient, HexString, Provider, Network} from "aptos";
import crypto, { randomInt } from 'crypto';
import { calculateCrashPoint } from "./crashPoint";
import {getAdminAccount} from "./aptos"
import getConfig from "./envManager";
import 'dotenv/config';
import { start } from "repl";

require('dotenv').config();
const { MODULE_ADDRESS,
  ADMIN_ACCOUNT_PRIVATE_KEY,
  NODE_URL } = getConfig()


const client = new AptosClient(NODE_URL);
const provider = new Provider({
  fullnodeUrl: NODE_URL,
})

const TRANSACTION_OPTIONS = {
    max_gas_amount: '10000',
    gas_unit_price: '100',
};

const fromHexString = (hexString: any) =>
    Uint8Array.from(hexString.match(/.{1,2}/g).map((byte: any) => parseInt(byte, 16)));

// public entry fun init_LP_pool<BettingCoinType, LPCoinType>(
//     admin: &signer,
//     lp_token_name: String, 
//     lp_token_ticker: String, 
//     lp_token_decimals: u8
//   ) acquires State {

async function ensure_coin_is_registered(adminAccount: AptosAccount, coin_type_arg: string) {
    const payload = await provider.generateTransaction(
        adminAccount.address(),
        {
          function: `0x1::managed_coin::register`,
          type_arguments: [coin_type_arg],
          arguments: []
        },
        TRANSACTION_OPTIONS
      );
    
    const tx = await provider.signAndSubmitTransaction(adminAccount, payload);
    const res = await client.waitForTransactionWithResult(tx);
    console.log("Register TX: "+res.hash)
}

async function deploy_coin_pool(){
    const BETTING_COIN_TYPE_ARG = `${MODULE_ADDRESS}::z_apt::ZAPT`
    const LIQ_COIN_TYPE_ARG = `${MODULE_ADDRESS}::new_lp_tokens::ZAPT_DEVNET_LP`

    const adminAccount = getAdminAccount();

    await ensure_coin_is_registered(adminAccount, BETTING_COIN_TYPE_ARG)

    const mint_payload = await provider.generateTransaction(
        adminAccount.address(),
        {
          function: `${MODULE_ADDRESS}::z_apt::mint`,
          type_arguments: [],
          arguments: [
            10000000000000,
            adminAccount.address()
          ]
        },
        TRANSACTION_OPTIONS
      );
    
    const mint_tx = await provider.signAndSubmitTransaction(adminAccount, mint_payload);
    const mint_txResult = await client.waitForTransactionWithResult(mint_tx);

    console.log("TX: "+mint_txResult.hash)

    const payload = await provider.generateTransaction(
        adminAccount.address(),
        {
          function: `${MODULE_ADDRESS}::liquidity_pool::init_LP_pool`,
          type_arguments: [BETTING_COIN_TYPE_ARG, LIQ_COIN_TYPE_ARG],
          arguments: [
            "ZAPT_LP_TOKEN",
            "ZAPT_LP",
            8
          ]
        },
        TRANSACTION_OPTIONS
      );
    
      const tx = await provider.signAndSubmitTransaction(adminAccount, payload);
      const txResult = await client.waitForTransactionWithResult(tx);

      console.log("Init TX: "+txResult.hash)
}

deploy_coin_pool()