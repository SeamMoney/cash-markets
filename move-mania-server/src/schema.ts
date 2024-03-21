export type User = {
  address: string;
  username: string | null;
};

export type Game = {
  game_id: string;
  start_time: number;
  secret_crash_point: number;
  status: "IN_PROGRESS" | "END";
  txnHash: string | null;
};

export type PlayerListEntry = {
  user_id: string;
  bet_type: string;
  bet_amount: number;
  crash_point?: number;
};

export type ChatMessage = {
  message_id: string;
  user_id: string;
  message: string;
  sent_at: string;
  username: string;
};

export const UserSchema = `CREATE TABLE IF NOT EXISTS users (
  address TEXT PRIMARY KEY,
  username TEXT default NULL
)`;

export const GameSchema = `CREATE TABLE IF NOT EXISTS games (
  game_id TEXT PRIMARY KEY,
  start_time TIMESTAMP,
  secret_crash_point FLOAT,
  status TEXT CHECK (status IN ('IN_PROGRESS', 'ENDED')),
  txnHash TEXT default NULL
)`;

export const PlayerListSchema = `CREATE TABLE IF NOT EXISTS player_list (
  bet_type TEXT,
  bet_amount FLOAT,
  crash_point FLOAT DEFAULT NULL,
  user_id TEXT PRIMARY KEY,
  FOREIGN KEY (user_id) REFERENCES users(address)
)`;

export const ChatMessageSchema = `CREATE TABLE IF NOT EXISTS chat_messages (
  message_id TEXT PRIMARY KEY,
  message TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(address)
)`;

export const AllSchemas = [
  UserSchema,
  GameSchema,
  PlayerListSchema,
  ChatMessageSchema,
  "",
].join(";\n");
