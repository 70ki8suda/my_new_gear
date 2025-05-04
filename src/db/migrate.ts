import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index';

/**
 * データベースマイグレーションを実行する
 *
 * このスクリプトは、drizzle/以下のマイグレーションファイルを使用して
 * データベーススキーマを最新の状態に更新します。
 */
async function main() {
  console.log('マイグレーションを開始します...');

  try {
    await migrate(db, { migrationsFolder: 'drizzle' });
    console.log('マイグレーションが正常に完了しました。');
  } catch (error) {
    console.error('マイグレーション中にエラーが発生しました:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
