import 'dotenv/config';
import type { Config } from 'drizzle-kit';

/**
 * Drizzle ORMの設定
 *
 * このファイルはDrizzle ORMのマイグレーションと
 * スキーマ管理を設定します。
 */
export default {
  // 使用するデータベースの種類
  dialect: 'postgresql',

  // スキーマファイルのパターン
  schema: './src/db/schema/*',

  // マイグレーションファイルの出力先
  out: './drizzle',

  // データベース接続情報
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'my_new_gear',
  },
} satisfies Config;
