import { afterAll, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../src/db';

// モックオブジェクトのリセット
beforeEach(() => {
  vi.resetAllMocks();
});

// テスト環境のセットアップ
beforeAll(async () => {
  // テスト用環境変数の設定
  process.env.NODE_ENV = 'test';

  // データベース接続テスト
  try {
    // テスト用のマイグレーションを実行
    // 本番環境では別のテスト用DBに接続するように設定
    if (process.env.CI !== 'true') {
      console.log('テスト用DBに接続しています...');
    }
  } catch (error) {
    console.error('テストDBの設定中にエラーが発生しました:', error);
    throw error;
  }
});

// テスト環境のクリーンアップ
afterAll(async () => {
  // データベース接続クローズなど
  // 本番環境ではここでテスト用DBの接続を閉じる
  if (process.env.CI !== 'true') {
    console.log('テスト終了: DB接続をクリーンアップします...');
  }
});
