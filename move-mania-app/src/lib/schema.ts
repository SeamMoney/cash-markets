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

export const UserSchema = `CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  username TEXT,
  image TEXT,
  public_address TEXT,
  private_key TEXT,
  balance REAL,
  referral_code TEXT,
  referred_by TEXT
)`;