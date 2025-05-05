import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../middlewares/auth.middleware';
import { z } from 'zod';
import { getFollowingUsersFeed, getFollowingTagsFeed, getCombinedFeed } from '../services/feed.service';
import { zValidator } from '@hono/zod-validator';

// --- クエリパラメータ検証スキーマ ---
const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const feedRouter = new Hono();

// すべてのフィードエンドポイントには認証が必要
feedRouter.use('/*', authMiddleware);

/**
 * フォロー中のユーザーの投稿フィードを取得
 * GET /api/feed/users
 */
feedRouter.get('/users', zValidator('query', feedQuerySchema), async (c) => {
  try {
    const user = c.get('user');
    const { limit, offset } = c.req.valid('query');

    const posts = await getFollowingUsersFeed(user.id, limit, offset);

    return c.json({
      posts,
      pagination: {
        limit,
        offset,
        total: posts.length, // 注: 正確な総数を取得するには別のカウントクエリが必要
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('フォロー中ユーザーフィード取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * フォロー中のタグに関連する投稿フィードを取得
 * GET /api/feed/tags
 */
feedRouter.get('/tags', zValidator('query', feedQuerySchema), async (c) => {
  try {
    const user = c.get('user');
    const { limit, offset } = c.req.valid('query');

    const posts = await getFollowingTagsFeed(user.id, limit, offset);

    return c.json({
      posts,
      pagination: {
        limit,
        offset,
        total: posts.length, // 注: 正確な総数を取得するには別のカウントクエリが必要
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('フォロー中タグフィード取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * フォロー中のユーザーとタグを統合したフィードを取得
 * GET /api/feed
 */
feedRouter.get('/', zValidator('query', feedQuerySchema), async (c) => {
  try {
    const user = c.get('user');
    const { limit, offset } = c.req.valid('query');

    const posts = await getCombinedFeed(user.id, limit, offset);

    return c.json({
      posts,
      pagination: {
        limit,
        offset,
        total: posts.length, // 注: 正確な総数を取得するには別のカウントクエリが必要
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('統合フィード取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

export default feedRouter;
