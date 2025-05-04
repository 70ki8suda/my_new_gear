import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middlewares/auth.middleware';
import { z } from 'zod';
import { UserIdSchema } from '../types/branded.d';
import { followUser, unfollowUser } from '../services/follow.service';
import { zValidator } from '@hono/zod-validator';

// --- パラメータ検証スキーマ ---
const userIdParamSchema = z.object({ userId: UserIdSchema });

const userRouter = new Hono();

// 認証が必要なルート ( /me 以外も認証が必要になる場合があるため、共通化)
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
userRouter.put(
  '/me',
  zValidator(
    'json',
    z.object({
      bio: z.string().max(1000).optional(),
      avatarUrl: z.string().url().optional(),
    })
  ),
  async (c) => {
    try {
      const user = c.get('user');
      const input = c.req.valid('json');

      const updateData = {
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        updatedAt: new Date(),
      };

      if (Object.keys(updateData).length === 1) {
        throw new HTTPException(400, { message: '更新するデータが指定されていません' });
      }

      const updatedUserArray = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, user.id as number)) // DB操作なのでキャスト
        .returning({
          // 戻り値スキーマで検証したいフィールドを返す
          id: users.id,
          username: users.username,
          email: users.email,
          bio: users.bio,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (updatedUserArray.length === 0) {
        throw new HTTPException(404, { message: 'ユーザーが見つかりませんでした' });
      }
      // TODO: 戻り値をZodで検証する (SafeUserSchema を共通化するか再定義)
      // const safeUpdatedUser = SafeUserSchema.parse(updatedUserArray[0]);

      return c.json({
        message: 'プロフィールが更新されました',
        user: updatedUserArray[0], // 仮：検証前のデータを返す
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      console.error('ユーザー情報更新中にエラーが発生しました:', error);
      throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
    }
  }
);

// --- フォロー関連ルート ---

/**
 * 指定したユーザーをフォローする
 * POST /api/users/:userId/follow
 */
userRouter.post('/:userId/follow', zValidator('param', userIdParamSchema), async (c) => {
  try {
    const follower = c.get('user'); // フォローする人 (ログインユーザー)
    const { userId: followeeId } = c.req.valid('param'); // フォローされる人

    const result = await followUser(follower.id, followeeId);

    return c.json(result);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('フォロー処理中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 指定したユーザーのフォローを解除する
 * DELETE /api/users/:userId/follow
 */
userRouter.delete('/:userId/follow', zValidator('param', userIdParamSchema), async (c) => {
  try {
    const follower = c.get('user'); // フォロー解除する人 (ログインユーザー)
    const { userId: followeeId } = c.req.valid('param'); // フォロー解除される人

    const result = await unfollowUser(follower.id, followeeId);

    return c.json(result);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('フォロー解除処理中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

export default userRouter;
