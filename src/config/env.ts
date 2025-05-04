import 'dotenv/config';
import { z } from 'zod';

/**
 * 環境変数のスキーマ定義
 *
 * サーバーの実行に必要な環境変数を定義し、
 * 適切な型とデフォルト値を設定します。
 */
const envSchema = z.object({
  // アプリケーション設定
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('localhost'),

  // データベース設定
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('my_new_gear'),
  DATABASE_URL: z.string(), // .envから直接読み込むため、デフォルト値は不要

  // JWT認証設定
  JWT_SECRET: z.string().default('dev_secret_key'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

// 環境変数の型を定義
type Env = z.infer<typeof envSchema>;

/**
 * 環境変数を検証して設定
 *
 * process.envから環境変数を取得し、
 * スキーマに基づいて検証します。
 * 型安全な環境変数オブジェクトとして提供します。
 */
export const config: Env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  HOST: process.env.HOST,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
});
