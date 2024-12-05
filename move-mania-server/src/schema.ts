export type User = {
  username: string;
  image: string;
  email: string;
  public_address: string;
  private_key: string;
  balance: number;
  referral_code: string;
  referred_by: string | null;
};

export type Game = {
  game_id: string;
  start_time: number;
  secret_crash_point: number;
  status: "IN_PROGRESS" | "END";
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

// export const UserSchema = `CREATE TABLE IF NOT EXISTS users (
//   address TEXT PRIMARY KEY NOT NULL UNIQUE,
//   username TEXT NOT NULL UNIQUE,
//   referral_code TEXT NOT NULL UNIQUE,
//   referred_by TEXT DEFAULT NULL
// )`;

export const UserSchema = `CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  username TEXT,
  image TEXT,
  public_address TEXT,
  private_key TEXT,
  balance FLOAT,
  referral_code TEXT,
  referred_by TEXT
)`;

export const GameSchema = `CREATE TABLE IF NOT EXISTS games (
  game_id TEXT PRIMARY KEY,
  start_time TIMESTAMP,
  secret_crash_point FLOAT,
  status TEXT CHECK (status IN ('IN_PROGRESS', 'ENDED'))
)`;

export const PlayerListSchema = `CREATE TABLE IF NOT EXISTS player_list (
  bet_type TEXT,
  bet_amount FLOAT,
  crash_point FLOAT DEFAULT NULL,
  user_id TEXT PRIMARY KEY,
  FOREIGN KEY (user_id) REFERENCES users(email)
)`;

export const ChatMessageSchema = `CREATE TABLE IF NOT EXISTS chat_messages (
  message_id TEXT PRIMARY KEY,
  message TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(email)
)`;

export const AllSchemas = [
  UserSchema,
  GameSchema,
  PlayerListSchema,
  ChatMessageSchema,
  "",
].join(";\n");
