import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createPostSchema } from '../models/post.model';
import { createPost, getPostById, getItemPosts } from '../services/post.service';
import { likePost, unlikePost } from '../services/like.service';

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
postRouter.get('/:postId', async (c) => {
  try {
    const postId = parseInt(c.req.param('postId'), 10);
    if (isNaN(postId)) {
      throw new HTTPException(400, { message: '無効なポストIDです' });
    }

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
postRouter.get('/item/:itemId', async (c) => {
  try {
    const itemId = parseInt(c.req.param('itemId'), 10);
    if (isNaN(itemId)) {
      throw new HTTPException(400, { message: '無効なアイテムIDです' });
    }

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
postRouter.post('/:postId/like', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const postId = parseInt(c.req.param('postId'), 10);
    if (isNaN(postId)) {
      throw new HTTPException(400, { message: '無効なポストIDです' });
    }

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
postRouter.delete('/:postId/like', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const postId = parseInt(c.req.param('postId'), 10);
    if (isNaN(postId)) {
      throw new HTTPException(400, { message: '無効なポストIDです' });
    }

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
