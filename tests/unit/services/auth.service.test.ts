import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDb, resetMockDb } from '../../mocks/db';
import { HTTPException } from 'hono/http-exception';

// 認証サービスのモック
vi.mock('../../../src/db', () => ({
  db: mockDb,
}));

// bcryptのモック
vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password'),
  compare: vi.fn().mockImplementation((plain, hash) => Promise.resolve(plain === 'correct_password')),
}));

// jwtのモック
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn().mockReturnValue('mock_jwt_token'),
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
      mockDb.execute.mockResolvedValueOnce([]); // ユーザー存在チェック
      mockDb.execute.mockResolvedValueOnce([
        {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          createdAt: new Date(),
        },
      ]); // ユーザー作成

      const result = await signupUser(signupData);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('username', 'testuser');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
    });

    it('ユーザー名が既に存在する場合はエラーを返すこと', async () => {
      // ユーザーが既に存在する場合のモック
      mockDb.execute.mockResolvedValueOnce([{ username: 'testuser' }]);

      await expect(signupUser(signupData)).rejects.toThrow(HTTPException);
      await expect(signupUser(signupData)).rejects.toThrow('ユーザー名が既に使用されています');
    });

    it('メールアドレスが既に存在する場合はエラーを返すこと', async () => {
      // ユーザー名チェックは通過、メールチェックで既存ユーザーを返す
      mockDb.execute.mockResolvedValueOnce([]);
      mockDb.execute.mockResolvedValueOnce([{ email: 'test@example.com' }]);

      await expect(signupUser(signupData)).rejects.toThrow(HTTPException);
      await expect(signupUser(signupData)).rejects.toThrow('メールアドレスが既に使用されています');
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
