import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createPostSchema } from '../models/post.model';
import { createPost, getPostById, getItemPosts } from '../services/post.service';
import { likePost, unlikePost } from '../services/like.service';
import { PostIdSchema, ItemIdSchema } from '../types/branded.d';
import { z } from 'zod';

// --- パラメータ検証スキーマ (コントローラーファイル内に定義) ---
const postIdParamSchema = z.object({ postId: PostIdSchema });
const itemIdParamSchema = z.object({ itemId: ItemIdSchema });
// --- ここまで ---

const postRouter = new Hono();

/**
 * 新しいポストを作成
 * POST /api/posts
 * リクエストボディで itemId を指定
 */
postRouter.post('/', authMiddleware, zValidator('json', createPostSchema), async (c) => {
  try {
    const user = c.get('user');
    const input = c.req.valid('json');

    // サービスを呼び出してポストを作成
    const post = await createPost(user.id, input);

    return c.json(
      {
        message: 'ポストが正常に作成されました',
        post,
      },
      201
    );
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('ポスト作成中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 特定のポストを取得
 * GET /api/posts/:postId
 */
postRouter.get('/:postId', zValidator('param', postIdParamSchema), async (c) => {
  try {
    const { postId } = c.req.valid('param');
    const post = await getPostById(postId);

    return c.json({ post });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('ポスト取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 特定のアイテムに関連するポスト一覧を取得
 * GET /api/items/:itemId/posts
 * このエンドポイントは Item ルーターに含めるべきかもしれないが、一旦ここに置く
 */
// 注意: このルートは itemRouter に移動する方が適切かもしれません。
// itemRouter.get('/:itemId/posts', ...) のように。
// 今回は postRouter に実装します。
postRouter.get('/item/:itemId', zValidator('param', itemIdParamSchema), async (c) => {
  try {
    const { itemId } = c.req.valid('param');
    const posts = await getItemPosts(itemId);

    return c.json({ posts });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('アイテムのポスト一覧取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 特定のポストにいいねする
 * POST /api/posts/:postId/like
 */
postRouter.post('/:postId/like', authMiddleware, zValidator('param', postIdParamSchema), async (c) => {
  try {
    const user = c.get('user');
    const { postId } = c.req.valid('param');

    const result = await likePost(user.id, postId);

    return c.json({
      message: result.message || 'いいねしました',
      likesCount: result.likesCount,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('いいね処理中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 特定のポストのいいねを取り消す
 * DELETE /api/posts/:postId/like
 */
postRouter.delete('/:postId/like', authMiddleware, zValidator('param', postIdParamSchema), async (c) => {
  try {
    const user = c.get('user');
    const { postId } = c.req.valid('param');

    const result = await unlikePost(user.id, postId);

    return c.json({
      message: result.message || 'いいねを取り消しました',
      likesCount: result.likesCount,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('いいね取り消し処理中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

export default postRouter;
