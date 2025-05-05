import { describe, it, expect, beforeEach, vi } from 'vitest';
import { app } from '../../../src/index';
import { HTTPException } from 'hono/http-exception';

// authサービスをモック化
vi.mock('../../../src/services/auth.service', () => ({
  loginUser: vi.fn().mockImplementation(async (data) => {
    if (data.email === 'test@example.com' && data.password === 'correct_password') {
      return 'mocked_jwt_token';
    }
    throw new HTTPException(401, { message: 'メールアドレスまたはパスワードが正しくありません' });
  }),
  signupUser: vi.fn().mockImplementation(async (data) => {
    // ユーザー名の重複チェック
    if (data.username === 'existing_user') {
      throw new HTTPException(409, { message: 'このユーザー名は既に使用されています' });
    }
    // メールアドレスの重複チェック
    if (data.email === 'existing@example.com') {
      throw new HTTPException(409, { message: 'このメールアドレスは既に使用されています' });
    }
    return {
      id: 1,
      username: data.username,
      email: data.email,
      bio: null,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: null,
    };
  }),
}));

// 依存関係モジュールをモック化することで型の問題を回避
vi.mock('../../../src/db', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    execute: vi.fn(),
  },
}));

describe('認証ルートのテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/signup', () => {
    it('有効なデータで新規ユーザーを登録できること', async () => {
      const response = await app.request('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123!',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('username', 'testuser');
      expect(data.user).toHaveProperty('email', 'test@example.com');
      expect(data.user).not.toHaveProperty('passwordHash');
    });

    it('既存ユーザー名で登録しようとするとエラーになること', async () => {
      const response = await app.request('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'existing_user',
          email: 'new@example.com',
          password: 'Password123!',
        }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('ユーザー名は既に使用されています');
    });

    it('既存メールアドレスで登録しようとするとエラーになること', async () => {
      const response = await app.request('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'newuser',
          email: 'existing@example.com',
          password: 'Password123!',
        }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('メールアドレスは既に使用されています');
    });

    it('無効なデータでリクエストするとバリデーションエラーになること', async () => {
      const response = await app.request('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'te', // 短すぎるユーザー名
          email: 'invalid-email',
          password: '123', // 弱すぎるパスワード
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('message');
    });
  });

  describe('POST /api/auth/login', () => {
    it('正しい認証情報でログインできること', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'correct_password',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('token', 'mocked_jwt_token');
    });

    it('存在しないメールアドレスではログインできないこと', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'anything',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('メールアドレスまたはパスワードが正しくありません');
    });

    it('間違ったパスワードではログインできないこと', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrong_password',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('メールアドレスまたはパスワードが正しくありません');
    });
  });
});
