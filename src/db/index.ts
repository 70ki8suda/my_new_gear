import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config/env';

// データベース接続URLの構築
const connectionString = `postgres://${config.DB_USER}:${config.DB_PASSWORD}@${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`;

// Postgresクライアントの初期化
const sql = postgres(connectionString, {
  max: 10, // 接続プールの最大数
  idle_timeout: 30, // アイドル接続のタイムアウト時間（秒）
});

// Drizzle ORMの初期化
export const db = drizzle(sql);

// 接続のテスト関数
export async function testConnection() {
  try {
    const result = await sql`SELECT 1 as connection_test`;
    console.log('Database connection successful:', result[0].connection_test === 1);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
