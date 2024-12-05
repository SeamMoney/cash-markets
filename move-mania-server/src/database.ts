import { open } from "sqlite";
import {
  AllSchemas,
  ChatMessageSchema,
  Game,
  GameSchema,
  PlayerListEntry,
  PlayerListSchema,
  User,
  UserSchema,
} from "./schema";
import crypto from "crypto";
import { BetData, CashOutData, ChatMessage } from "./types";

const STARTING_BALANCE = 100;

export async function initializeGameTable() {
  const db = await open({
    filename: "./db/games.db",
    driver: require("sqlite3").Database,
  });

  await db.exec(GameSchema);

  await db.close();
}

export async function initializeUsersTable() {
  const db = await open({
    filename: "games.db",
    driver: require("sqlite3").Database,
  });

  await db.exec(UserSchema);
}

export async function initializeChatMessagesTable() {
  const db = await open({
    filename: "./db/chat_messages.db",
    driver: require("sqlite3").Database,
  });

  await db.exec(ChatMessageSchema);

  await db.close();
}

export async function initializePlayerListTable() {
  const db = await open({
    filename: "./db/player_list.db",
    driver: require("sqlite3").Database,
  });

  await db.exec(PlayerListSchema);

  await db.close();
}

export async function initializeAllTables() {
  // await initializeGameTable();
  // await initializeUsersTable();
  // await initializeChatMessagesTable();
  // await initializePlayerListTable();

  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  await db.exec(UserSchema);
  await db.exec(GameSchema);
  await db.exec(PlayerListSchema);
  await db.exec(ChatMessageSchema);

  await db.close();
}

export async function getUsers() {
  await initializeAllTables(); // initialize tables if not yet initialized

  // Open the database
  const db = await open({
    filename: "games.db",
    driver: require("sqlite3").Database,
  });

  // Get all the users
  const users = (await db.all("SELECT * FROM users")) as User[];

  await db.close();

  return users;
}

export async function createUser(user: User) {
  await initializeAllTables();

  const db = await open({
    filename: "games.db",
    driver: require("sqlite3").Database,
  });

  await db.run(
    "INSERT INTO users (username, image, email, public_address, private_key, balance, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    user.username,
    user.image,
    user.email,
    user.public_address,
    user.private_key,
    STARTING_BALANCE,
    user.referral_code,
    user.referred_by
  );

  await db.close();
}

export async function getUser(email: string) {
  await initializeAllTables();

  const db = await open({
    filename: "games.db",
    driver: require("sqlite3").Database,
  });

  const user = await db.get("SELECT * FROM users WHERE email = ?", email) as User | undefined;

  await db.close();

  return user;
}

export async function updateUser(email: string, user: User) {
  await initializeAllTables();

  const db = await open({
    filename: "games.db",
    driver: require("sqlite3").Database,
  });

  await db.run(
    "UPDATE users SET image = ?, username = ?, public_address = ?, private_key = ?, balance = ?, referral_code = ?, referred_by = ? WHERE email = ?",
    user.image,
    user.username,
    user.public_address,
    user.private_key,
    user.balance,
    user.referral_code,
    user.referred_by,
    email
  );

  await db.close();
}

export async function deleteUser(email: string) {
  await initializeAllTables();

  const db = await open({
    filename: "games.db",
    driver: require("sqlite3").Database,
  });

  await db.run("DELETE FROM users WHERE email = ?", email);

  await db.close();
}

/**
 *
 * @description This function gets all the games from the database.
 * This function is to be used on the client side to get all the games.
 *
 * @returns A list of all the games in the database
 */
export async function getGames() {
  await initializeAllTables(); // initialize tables if not yet initialized

  // Open the database
  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  // Get all the games
  const games = await db.all("SELECT * FROM games");

  await db.close();

  return games;
}

export async function hasUserBet(email: string) {
  await initializeAllTables(); // initialize tables if not yet initialized

  // Open the database
  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  const result = await db.get(
    "SELECT * FROM player_list WHERE user_id = ?",
    email
  );

  await db.close();

  return result !== undefined;
}

export async function hasUserCashOut(email: string) {
  await initializeAllTables(); // initialize tables if not yet initialized

  // Open the database
  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  const result = await db.get(
    "SELECT * FROM player_list WHERE user_id = ? AND crash_point IS NOT NULL",
    email
  );

  await db.close();

  return result !== undefined;
}

/**
 * @description This function creates a game in the database.
 * It is to be used on the server side to create a game.
 *
 * @param game The game to be created
 */
export async function createGame(game: Game) {
  await initializeAllTables(); // initialize tables if not yet initialized

  // Open the database
  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  await db.run(
    "INSERT INTO games (game_id, start_time, secret_crash_point, status) VALUES (?, ?, ?, ?)",
    game.game_id,
    game.start_time,
    game.secret_crash_point,
    game.status
  );

  await db.close();
}

/**
 *
 * @description This function gets the game that is currently in progress.
 * This function is to be used on the client side to get the game that is currently in progress.
 *
 * @returns The game that is currently in progress
 */
export async function getCurrentGame() {
  await initializeAllTables(); // initialize tables if not yet initialized

  // Open the database
  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  // Get the first occurence of a game with status "IN_PROGRESS"
  const game = await db.get('SELECT * FROM games ORDER BY start_time DESC LIMIT 1');

  await db.close();

  return game as Game | undefined;
}

/**
 *
 * @description This function ends the game with the given id.
 * This function is to be used on the server side to end a game.
 *
 * @param gameId The id of the game to be ended
 */
export async function endGame(gameId: string) {
  await initializeAllTables(); // initialize tables if not yet initialized

  // Open the database
  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  await db.run('UPDATE games SET status = "ENDED" WHERE game_id = ?', gameId);

  await db.run("DELETE FROM player_list");

  await db.close();
}

export async function clearGames() {
  await initializeAllTables(); // initialize tables if not yet initialized

  // Open the database
  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  await db.run("DELETE FROM games");

  await db.close();
}

/**
 *
 * @description This function gets all the players in the player list.
 * This function is to be used on the client side to get all the players in the player list.
 *
 * @returns A list of all the players in the player list
 */
export async function getPlayerList() {
  await initializeAllTables();

  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  const players = await db.all(
    "SELECT user_id, username, bet_type, bet_amount, crash_point FROM player_list JOIN users ON player_list.user_id = users.email"
  );

  await db.close();

  return players as PlayerListEntry[];
}

/**
 *
 * @description This function adds a bet to the player list.
 * This function is to be used on the server side to add a bet to the player list.
 *
 * @param bet The bet to be added to the player list
 */
export async function addBetToPlayerList(bet: BetData) {
  await initializeAllTables(); // initialize tables if not yet initialized

  // Open the database
  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  try {
    await db.run(
      "INSERT INTO player_list (bet_type, bet_amount, user_id) VALUES (?, ?, ?)",
      bet.coinType,
      bet.betAmount,
      bet.playerEmail
    );
  } catch (e) {
    console.log(e);
  }

  await db.close();
}

/**
 * @description This function adds a cash out to the player list.
 * This function is to be used on the server side to add a cash out to the player list.
 *
 * @param cashOut The cash out to be added to the player list
 */
export async function addCashOutToPlayerList(cashOut: CashOutData) {
  await initializeAllTables();

  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  try {
    console.log('Updating player list with cash out:', cashOut);
    const result = await db.run(
      "UPDATE player_list SET crash_point = ? WHERE user_id = ?",
      cashOut.cashOutMultiplier,
      cashOut.playerEmail
    );
    console.log("Cash out update result:", result);

    if (result.changes === 0) {
      console.error('No rows updated. Player not found or crash_point already set.');
      return false;
    }

    const updatedPlayer = await db.get(
      "SELECT * FROM player_list WHERE user_id = ?",
      cashOut.playerEmail
    );
    console.log("Updated player data:", updatedPlayer);

    if (!updatedPlayer) {
      console.error('Failed to retrieve updated player data');
      return false;
    }
    return true;

  } catch (error) {
    console.error("Error updating player list with cash out:", error);
  } finally {
    await db.close();
  }
}

export async function getUserByReferralCode(referralCode: string) {
  await initializeAllTables();

  const db = await open({
    filename: "games.db",
    driver: require("sqlite3").Database,
  });

  const user = await db.get(
    "SELECT * FROM users WHERE referral_code = ?",
    referralCode
  );

  await db.close();

  return user;
}

/**
 * @description Removes all of the players from the player list.
 * This function is to be used on the server side to remove all of the players from the player list.
 *
 * @todo This function needs to include logic to pay out players
 */
export async function clearPlayerList() {
  await initializeAllTables(); // initialize tables if not yet initialized

  // Open the database
  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  await db.run("DELETE FROM player_list");

  await db.close();
}

/**
 * @description Adds a chat message to the chat messages.
 * If there are more than 100 chat messages, the oldest chat messages are deleted.
 * This function is to be used on the server side to add a chat message to the chat messages.
 *
 * @param chatMessage The chat message to be added to the chat messages
 */
export async function addChatMessage(chatMessage: ChatMessage) {
  await initializeAllTables(); // initialize tables if not yet initialized

  // Open the database
  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  await db.run(
    "INSERT INTO chat_messages (message_id, message, user_id) VALUES (?, ?, ?)",
    chatMessage.authorEmail + Math.random().toString(36).substring(7),
    chatMessage.message,
    chatMessage.authorEmail
  );

  await db.run(
    "DELETE FROM chat_messages WHERE message_id NOT IN (SELECT message_id FROM chat_messages ORDER BY sent_at DESC LIMIT 100)"
  );

  await db.close();
}

/**
 * @description Gets all the chat messages in the chat messages.
 * This function is to be used on the client side to get all the chat messages.
 *
 * @returns A list of all the chat messages in chronological order
 */
export async function getChatMessages() {
  await initializeAllTables();

  const db = await open({
    filename: "./games.db",
    driver: require("sqlite3").Database,
  });

  const chatMessages = await db.all(
    "SELECT chat_messages.user_id, users.username, chat_messages.message FROM chat_messages JOIN users ON chat_messages.user_id = users.email"
  );

  await db.close();

  return chatMessages as ChatMessage[];
}

export async function initializeApiKeyTable() {
  const db = await open({
    filename: "./db/api_keys.db",
    driver: require("sqlite3").Database,
  });

  await db.exec(
    "CREATE TABLE IF NOT EXISTS api_keys (username TEXT PRIMARY KEY, api_key TEXT)"
  );

  await db.close();
}

export async function createKeyForUser(username: string) {
  initializeApiKeyTable(); // Initialize the api_keys table if it doesn't exist

  // Open the database
  const db = await open({
    filename: "./db/api_keys.db",
    driver: require("sqlite3").Database,
  });

  // Generate a random API key
  const apiKey = crypto.randomBytes(32).toString("hex");

  await db.run(
    "INSERT INTO api_keys (username, api_key) VALUES (?, ?)",
    username,
    apiKey
  );

  await db.close();
}

export async function isValidApiKey(apiKey: string) {
  initializeApiKeyTable(); // Initialize the api_keys table if it doesn't exist

  // Open the database
  const db = await open({
    filename: "./db/api_keys.db",
    driver: require("sqlite3").Database,
  });

  // Check if the API key exists
  const result = await db.get(
    "SELECT * FROM api_keys WHERE api_key = ?",
    apiKey
  );

  await db.close();

  return result !== undefined;
}