import { AptosAccount, AptosClient, HexString, Provider, Network} from "aptos";
import crypto, { randomInt } from 'crypto';
import { calculateCrashPoint } from "./crashPoint";
import getConfig from "./envManager";
import 'dotenv/config';
import { start } from "repl";

require('dotenv').config();
const { MODULE_ADDRESS,
  ADMIN_ACCOUNT_PRIVATE_KEY,
  NODE_URL } = getConfig()
// const MODULE_ADDRESS = process.env.MODULE_ADDRESS as string;
// const CRASH_RESOURCE_ACCOUNT_ADDRESS = process.env.CRASH_RESOURCE_ACCOUNT_ADDRESS as string;
// const LP_RESOURCE_ACCOUNT_ADDRESS = process.env.LP_RESOURCE_ACCOUNT_ADDRESS as string;
// const ADMIN_ACCOUNT_PRIVATE_KEY = process.env.ADMIN_ACCOUNT_PRIVATE_KEY as string;

// const RPC_URL = 'https://fullnode.testnet.aptoslabs.com';
// const FAUCET_URL = 'https://faucet.testnet.aptoslabs.com'

const BETTING_COIN_TYPE_ARG = `${MODULE_ADDRESS}::z_apt::ZAPT`
const LIQ_COIN_TYPE_ARG = `${MODULE_ADDRESS}::new_lp_tokens::ZAPT_DEVNET_LP`

const client = new AptosClient(NODE_URL);
const provider = new Provider({
  fullnodeUrl: NODE_URL,
})

const TRANSACTION_OPTIONS = {
  max_gas_amount: '10000',
  gas_unit_price: '100',
};


function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const fromHexString = (hexString: any) =>
  Uint8Array.from(hexString.match(/.{1,2}/g).map((byte: any) => parseInt(byte, 16)));

export function getAdminAccount() {
  return new AptosAccount(
    new HexString(ADMIN_ACCOUNT_PRIVATE_KEY).toUint8Array()
  );
}

export async function handleCashOut(playerAddress: string, cashOutAmount: number) {
  console.log("playerAddress", playerAddress);
  console.log("cashOutAmount", cashOutAmount);
  console.log("HANDLE CASH OUT FUNCTION CALL");
  console.log(`Attempting cash out for player: ${playerAddress}, amount: ${cashOutAmount}`);
  const adminAccount = getAdminAccount();

  try {
    const formattedAddress = playerAddress.startsWith('0x') ? playerAddress : `0x${playerAddress}`;

    const transaction = await provider.generateTransaction(
      adminAccount.address(),
      {
        function: `${MODULE_ADDRESS}::crash::cash_out`,
        type_arguments: [],
        arguments: [formattedAddress, cashOutAmount],
      },
      TRANSACTION_OPTIONS
    );

    // console.log('Generated transaction:', JSON.stringify(transaction, null, 2));
        console.log('Generated transaction:', JSON.stringify(transaction, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
      2
    ));

    const signedTx = await provider.signTransaction(adminAccount, transaction);
    const pendingTx = await provider.submitTransaction(signedTx);

    console.log('Submitted transaction, hash:', pendingTx.hash);

    const txResult = await client.waitForTransactionWithResult(pendingTx.hash);

    // console.log('Transaction result:', JSON.stringify(txResult, null, 2));
        console.log('Transaction result:', JSON.stringify(txResult, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
      2
    ));

    if ((txResult as any).success === false) {
      console.error('Transaction failed:', (txResult as any).vm_status);
      return null;
    }

    return { txnHash: txResult.hash };
  } catch (error) {
    console.error('Error in handleCashOut:', error);
    return null;
  }
}

export async function createNewGame(house_secret: string, salt: string): Promise<{ txnHash: string, startTime: number, randomNumber: string } | null> {
  if(await game_exists()){
    console.log("Game Exists")
    let {startTime, randomness} = await game_state()
    return {
      txnHash: "",
      startTime,
      randomNumber: randomness.toString()
    };
  }
  
  const adminAccount = getAdminAccount();

  const hashed_salted_house_secret = crypto.createHash("SHA3-256").update(`${house_secret}${salt}`).digest('hex');
  const hashed_salt = crypto.createHash("SHA3-256").update(salt).digest('hex');

  const createGameTxn = await provider.generateTransaction(
    adminAccount.address(),
    {
      function: `${MODULE_ADDRESS}::crash::start_game`,
      type_arguments: [],
      arguments: [
        fromHexString(hashed_salted_house_secret),
        fromHexString(hashed_salt)
      ]
    },
    TRANSACTION_OPTIONS
  );



  const tx = await provider.signAndSubmitTransaction(adminAccount, createGameTxn);
  const txResult = await client.waitForTransactionWithResult(tx);
  let {startTime, randomness} = await game_state();
  if ((txResult as any).success === false) {
    console.error("Transaction failed:", txResult);
    return null;
  }
  return {
    txnHash: txResult.hash,
    startTime: startTime as unknown as number,
    randomNumber: randomness.toString() as unknown as string
  }
}

export async function endGame(house_secret: string, salt: string, crashTime: number): Promise<{ txnHash: string } | null> {

  const adminAccount = getAdminAccount();

  // If the crash time is in the future, then wait until the crash time to end the game
  if (crashTime + 200 >= Date.now()) {
    await delay(crashTime + 1000 - Date.now());
  }


  const reveal_crashpoint_payload = await provider.generateTransaction(
    adminAccount.address(),
    {
      function: `${MODULE_ADDRESS}::crash::reveal_crashpoint`,
      type_arguments: [],
      arguments: [
        Uint8Array.from(Buffer.from(`${house_secret}${salt}`)),
        Uint8Array.from(Buffer.from(salt))
      ]
    },
    TRANSACTION_OPTIONS
  );

  const reveal_tx = await provider.signAndSubmitTransaction(adminAccount, reveal_crashpoint_payload);
  const reveal_res = await client.waitForTransactionWithResult(reveal_tx);

  if ((reveal_res as any).success === false) {
    console.log("REVEAL FAILED")
    console.log(reveal_res)
    return null;
  }


  const distribute_winnings_payload = await provider.generateTransaction(
    adminAccount.address(),
    {
      function: `${MODULE_ADDRESS}::crash::distribute_winnings`,
      type_arguments: [BETTING_COIN_TYPE_ARG, LIQ_COIN_TYPE_ARG],
      arguments: []
    },
    TRANSACTION_OPTIONS
  );

  const distribute_winnings_tx = await provider.signAndSubmitTransaction(adminAccount, distribute_winnings_payload);
  const distribute_res = await client.waitForTransactionWithResult(distribute_winnings_tx);

  if ((distribute_res as any).success === false) {
    console.log("DISTRIBUTE WINNINGS FAILED")
    console.log(distribute_res)
    return null;
  }

  const shutdown_payload = await provider.generateTransaction(
    adminAccount.address(),
    {
      function: `${MODULE_ADDRESS}::crash::shutdown_game`,
      type_arguments: [],
      arguments: []
    },
    TRANSACTION_OPTIONS
  );

  const shutdown_tx = await provider.signAndSubmitTransaction(adminAccount, shutdown_payload);
  const shutdown_res = await client.waitForTransactionWithResult(shutdown_tx);

  if ((shutdown_res as any).success === false) {
    console.log("SHUTDOWN GAME FAILED")
    console.log(shutdown_res)
    return null;
  }

  // console.log({
  //   txnHash: txResult.hash
  // })
  return {
    txnHash: distribute_res.hash
  }
}

export async function game_exists(): Promise<boolean> {
  console.log("Checking If Exists")
  const payload = {
    function: process.env.MODULE_ADDRESS+"::crash::game_exists",
    arguments: [],
    type_arguments: []
  };

  let res = await provider.view(payload);
  console.log(res)
  let res_indexed = (res[0] as boolean)
  console.log("Res: "+res)
  return res_indexed;
}

export async function game_state(): Promise<{startTime: number, randomness: number}> {
  const payload = {
    function: process.env.MODULE_ADDRESS+"::crash::game_state",
    arguments: [],
    type_arguments: []
  };

  let res = await provider.view(payload);
  let startTime = (res[0] as number);
  let randomness = (res[1] as number);
  return {startTime, randomness};
}

async function test_crashpoint_calculatation() {

  console.log(calculateCrashPoint('6904922446877749869', 'house_secretsalt'));

  const adminAccount = getAdminAccount();

  const createGameTxn = await provider.generateTransaction(
    adminAccount.address(),
    {
      function: `${MODULE_ADDRESS}::crash::test_out_calculate_crash_point_with_randomness`,
      type_arguments: [],
      arguments: [
        '6904922446877749869',
        'house_secretsalt'
      ]
    },
    TRANSACTION_OPTIONS
  );

  const tx = await provider.signAndSubmitTransaction(adminAccount, createGameTxn);

  const txResult = await client.waitForTransactionWithResult(tx);

  console.log(txResult.hash)
}

// test_crashpoint_calculatation()

// createNewGame('house_secret', 'salt')
// endGame('house_secret', 'salt')

// console.log(crypto.createHash("SHA3-256").update(`house_secretsalt`).digest('hex'));
// console.log(crypto.createHash("SHA3-256").update(`salt`).digest('hex'));

// console.log(fromHexString(crypto.createHash("SHA3-256").update(`house_secretsalt`).digest('hex')))
// console.log(fromHexString(crypto.createHash("SHA3-256").update(`salt`).digest('hex')))