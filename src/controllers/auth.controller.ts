import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { loginSchema, signupSchema } from '../models/auth.model';
import { loginUser, signupUser } from '../services/auth.service';

// 認証関連のルーターを作成
const authRouter = new Hono();

/**
 * ユーザー登録エンドポイント
 * POST /auth/signup
 */
authRouter.post('/signup', zValidator('json', signupSchema), async (c) => {
  try {
    const input = c.req.valid('json');
    const user = await signupUser(input);

    // パスワードハッシュなど機密情報を除外
    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    };

    return c.json(
      {
        message: 'ユーザーが正常に登録されました',
        user: safeUser,
      },
      201
    );
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('ユーザー登録中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * ログインエンドポイント
 * POST /auth/login
 */
authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const input = c.req.valid('json');
    const token = await loginUser(input);

    return c.json({
      message: 'ログインに成功しました',
      token,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('ログイン中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

export default authRouter;
