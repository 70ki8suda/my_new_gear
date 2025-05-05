import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../middlewares/auth.middleware';
import { z } from 'zod';
import { TagIdSchema } from '../types/branded.d'; // TagIdSchema をインポート
import { followTag, unfollowTag } from '../services/follow.service'; // フォローサービスをインポート
import { getAllTags, getTagById } from '../services/tag.service'; // タグサービスをインポート
import { zValidator } from '@hono/zod-validator';

// --- パラメータ検証スキーマ ---
const tagIdParamSchema = z.object({ tagId: TagIdSchema });
// TODO: タグ名でフォローする場合は tagNameParamSchema を定義

const tagRouter = new Hono();

// --- タグフォロー関連ルート ---

/**
 * 指定したタグをフォローする
 * POST /api/tags/:tagId/follow
 */
tagRouter.post('/:tagId/follow', authMiddleware, zValidator('param', tagIdParamSchema), async (c) => {
  try {
    const follower = c.get('user'); // フォローする人 (ログインユーザー)
    const { tagId } = c.req.valid('param'); // フォローされるタグID

    const result = await followTag(follower.id, tagId);

    return c.json(result);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('タグフォロー処理中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 指定したタグのフォローを解除する
 * DELETE /api/tags/:tagId/follow
 */
tagRouter.delete('/:tagId/follow', authMiddleware, zValidator('param', tagIdParamSchema), async (c) => {
  try {
    const follower = c.get('user'); // フォロー解除する人 (ログインユーザー)
    const { tagId } = c.req.valid('param'); // フォロー解除されるタグID

    const result = await unfollowTag(follower.id, tagId);

    return c.json(result);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('タグフォロー解除処理中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * タグ一覧を取得する
 * GET /api/tags
 */
tagRouter.get('/', async (c) => {
  try {
    const tags = await getAllTags();
    return c.json({ tags });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('タグ一覧取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * タグの詳細情報を取得する
 * GET /api/tags/:tagId
 */
tagRouter.get('/:tagId', zValidator('param', tagIdParamSchema), async (c) => {
  try {
    const { tagId } = c.req.valid('param');
    const tag = await getTagById(tagId);
    return c.json({ tag });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('タグ詳細取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

export default tagRouter;
