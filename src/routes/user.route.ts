import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../middlewares/auth.middleware';
import { zValidator } from '@hono/zod-validator';
import { getUserProfile, updateUserProfile } from '../services/user.service';
import {
  followUser,
  unfollowUser,
  getUserFollowCounts,
  getFollowers,
  getFollowing,
  getFollowingTags,
} from '../services/follow.service';
import { userIdParamSchema, updateProfileSchema } from '../validators/user.validator';
import { json } from 'stream/consumers';

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
    const userProfile = await getUserProfile(user.id);
    return c.json({ user: userProfile });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('自分のプロフィール取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * ユーザープロフィールの更新
 * PUT /api/users/me
 */
userRouter.put('/me', zValidator('json', updateProfileSchema), async (c) => {
  try {
    const user = c.get('user');
    const input = c.req.valid('json');
    const updatedUserProfile = await updateUserProfile(user.id, input);
    return c.json({ message: 'プロフィールが更新されました', user: updatedUserProfile });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('ユーザー情報更新中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

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

/**
 * 指定したユーザーのフォロー数/フォロワー数を取得する
 * GET /api/users/:userId/follow-counts
 */
userRouter.get('/:userId/follow-counts', zValidator('param', userIdParamSchema), async (c) => {
  try {
    const { userId } = c.req.valid('param');

    const counts = await getUserFollowCounts(userId);

    return c.json(counts);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('フォロー数/フォロワー数取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 指定したユーザーのフォロワー一覧を取得する
 * GET /api/users/:userId/followers
 */
userRouter.get('/:userId/followers', zValidator('param', userIdParamSchema), async (c) => {
  try {
    const { userId } = c.req.valid('param');

    const followers = await getFollowers(userId);

    return c.json({ followers });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('フォロワー一覧取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 指定したユーザーがフォローしているユーザー一覧を取得する
 * GET /api/users/:userId/following
 */
userRouter.get('/:userId/following', zValidator('param', userIdParamSchema), async (c) => {
  try {
    const { userId } = c.req.valid('param');

    const following = await getFollowing(userId);

    return c.json({ following });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('フォロー中ユーザー一覧取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 指定したユーザーがフォローしているタグ一覧を取得する
 * GET /api/users/:userId/following-tags
 */
userRouter.get('/:userId/following-tags', zValidator('param', userIdParamSchema), async (c) => {
  try {
    const { userId } = c.req.valid('param');

    const followingTags = await getFollowingTags(userId);

    return c.json({ followingTags });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('フォロー中タグ一覧取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

export default userRouter;
