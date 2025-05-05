import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDb, resetMockDb } from '../../mocks/db';
import { HTTPException } from 'hono/http-exception';

// 認証サービスのモック
vi.mock('../../../src/db', () => ({
  db: mockDb,
}));

// bcryptjsのモック
vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password'),
  compare: vi.fn().mockImplementation((plain, hash) => Promise.resolve(plain === 'correct_password')),
}));

// jwtのモック
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn().mockReturnValue('mock_jwt_token'),
}));

// 環境変数のモック
vi.mock('../../../src/config/env', () => ({
  config: {
    JWT_SECRET: 'test_secret',
    JWT_EXPIRES_IN: '1d',
  },
}));

// テスト対象のモジュールをインポート
// 注: モックのsetup後にインポートする必要があります
import { loginUser, signupUser } from '../../../src/services/auth.service';

describe('Auth Service', () => {
  beforeEach(() => {
    resetMockDb();
    vi.clearAllMocks();
  });

  describe('signupUser', () => {
    const signupData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('ユーザーが正常に登録されること', async () => {
      // モックの戻り値を設定
      mockDb.execute.mockResolvedValueOnce([]); // メールチェック
      mockDb.execute.mockResolvedValueOnce([]); // ユーザー名チェック
      mockDb.execute.mockResolvedValueOnce([
        {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          bio: null,
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: null,
        },
      ]); // ユーザー作成

      const result = await signupUser(signupData);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('username', 'testuser');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(mockDb.execute).toHaveBeenCalledTimes(3);
    });

    it('メールアドレスが既に存在する場合はエラーを返すこと', async () => {
      // ユーザーのメールアドレスが既に存在する場合のモック
      mockDb.execute.mockResolvedValueOnce([{ email: 'test@example.com' }]);

      await expect(signupUser(signupData)).rejects.toThrow(HTTPException);
      await expect(signupUser(signupData)).rejects.toThrow('このメールアドレスは既に使用されています');
    });

    it('ユーザー名が既に存在する場合はエラーを返すこと', async () => {
      // メールはOK、ユーザー名が既存の場合
      mockDb.execute.mockResolvedValueOnce([]);
      mockDb.execute.mockResolvedValueOnce([{ username: 'testuser' }]);

      await expect(signupUser(signupData)).rejects.toThrow(HTTPException);
      await expect(signupUser(signupData)).rejects.toThrow('このユーザー名は既に使用されています');
    });
  });

  describe('loginUser', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'correct_password',
    };

    it('有効な認証情報で正常にログインできること', async () => {
      // ユーザー検索結果のモック
      mockDb.execute.mockResolvedValueOnce([
        {
          id: 1,
          email: 'test@example.com',
          passwordHash: 'hashed_password',
          username: 'testuser',
        },
      ]);

      const result = await loginUser(loginData);

      expect(result).toBe('mock_jwt_token');
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('存在しないメールアドレスではエラーを返すこと', async () => {
      // ユーザーが見つからない場合
      mockDb.execute.mockResolvedValueOnce([]);

      await expect(loginUser(loginData)).rejects.toThrow(HTTPException);
      await expect(loginUser(loginData)).rejects.toThrow('メールアドレスまたはパスワードが正しくありません');
    });

    it('不正なパスワードではエラーを返すこと', async () => {
      // ユーザーは見つかるが、パスワードが間違っている場合
      mockDb.execute.mockResolvedValueOnce([
        {
          id: 1,
          email: 'test@example.com',
          passwordHash: 'hashed_password',
          username: 'testuser',
        },
      ]);

      const wrongLoginData = {
        email: 'test@example.com',
        password: 'wrong_password',
      };

      await expect(loginUser(wrongLoginData)).rejects.toThrow(HTTPException);
      await expect(loginUser(wrongLoginData)).rejects.toThrow('メールアドレスまたはパスワードが正しくありません');
    });
  });
});
