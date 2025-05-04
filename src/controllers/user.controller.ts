import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middlewares/auth.middleware';

const userRouter = new Hono();

// 認証が必要なルート
userRouter.use('/*', authMiddleware);

/**
 * 現在ログインしているユーザーの情報を取得
 * GET /api/users/me
 */
userRouter.get('/me', async (c) => {
  try {
    const user = c.get('user');

    // データベースから最新のユーザー情報を取得
    const userData = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        id: true,
        username: true,
        email: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!userData) {
      throw new HTTPException(404, { message: 'ユーザーが見つかりませんでした' });
    }

    return c.json({
      user: userData,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('ユーザー情報取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * ユーザープロフィールの更新
 * PUT /api/users/me
 */
userRouter.put('/me', async (c) => {
  try {
    const user = c.get('user');
    const input = await c.req.json();

    // 更新可能なフィールド
    const updateData = {
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
      updatedAt: new Date(),
    };

    // データが空の場合はエラー
    if (Object.keys(updateData).length === 1) {
      // updatedAtだけの場合
      throw new HTTPException(400, { message: '更新するデータが指定されていません' });
    }

    // ユーザー情報を更新
    const updatedUser = await db.update(users).set(updateData).where(eq(users.id, user.id)).returning({
      id: users.id,
      username: users.username,
      email: users.email,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

    if (updatedUser.length === 0) {
      throw new HTTPException(404, { message: 'ユーザーが見つかりませんでした' });
    }

    return c.json({
      message: 'プロフィールが更新されました',
      user: updatedUser[0],
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('ユーザー情報更新中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

export default userRouter;
