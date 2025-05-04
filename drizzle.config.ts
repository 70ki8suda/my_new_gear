import 'dotenv/config';

/**
 * Drizzle ORMの設定
 *
 * このファイルはDrizzle ORMのマイグレーションと
 * スキーマ管理を設定します。
 *
 * @type {import('drizzle-kit').Config}
 */
export default {
  // スキーマファイルのパターン
  schema: './src/db/schema/*',

  // マイグレーションファイルの出力先
  out: './drizzle',

  // 使用するデータベースドライバ
  driver: 'pg',

  // データベース接続情報
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || '',
  },
};
