import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../middlewares/auth.middleware';
import { zValidator } from '@hono/zod-validator';
import { getAllTags, getTagById } from '../services/tag.service'; // getAllTags, getTagById は tag.service から
import {
  followTag, // 名前変更: followTagByName -> followTag
  unfollowTag, // 名前変更: unfollowTagByName -> unfollowTag
} from '../services/follow.service'; // フォロー/アンフォローは follow.service から
import { tagIdParamSchema, tagNameParamSchema } from '../validators/tag.validator';

const tagRouter = new Hono();

// タグ一覧取得 (認証不要)
tagRouter.get('/', async (c) => {
  try {
    const tags = await getAllTags(); // 正しい関数名
    return c.json({ tags });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('タグ一覧取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

// --- 認証が必要なルート ---
tagRouter.use('/*', authMiddleware);

// タグをフォロー (名前で指定) - このルートは tagNameParamSchema を使うべき
tagRouter.post('/:tagName/follow', zValidator('param', tagNameParamSchema), async (c) => {
  try {
    const follower = c.get('user');
    const { tagName } = c.req.valid('param');

    // TODO: tagName から tagId を取得するロジックが必要 (tagService.findTagByName?)
    // 現状の実装では tagId が必要なので、このルートは一旦 501 を返す
    /*
    const tag = await tagRepository.findTagByName(tagName); // 仮: tagRepository が必要
    if (!tag) {
      throw new HTTPException(404, { message: 'タグが見つかりません' });
    }
    const result = await followTag(follower.id, tag.id as TagId);
    return c.json(result);
    */
    throw new HTTPException(501, { message: 'タグ名によるフォローは未実装です' });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('タグフォロー(名前指定)処理中にエラー:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

// タグのフォローを解除 (名前で指定) - 同上
tagRouter.delete('/:tagName/follow', zValidator('param', tagNameParamSchema), async (c) => {
  try {
    const follower = c.get('user');
    const { tagName } = c.req.valid('param');
    // TODO: tagName から tagId を取得するロジックが必要
    /*
    const tag = await tagRepository.findTagByName(tagName); // 仮
    if (!tag) { throw new HTTPException(404, { message: 'タグが見つかりません' }); }
    const result = await unfollowTag(follower.id, tag.id as TagId);
    return c.json(result);
    */
    throw new HTTPException(501, { message: 'タグ名によるフォロー解除は未実装です' });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('タグフォロー解除処理中にエラーが発生しました:', error);
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
