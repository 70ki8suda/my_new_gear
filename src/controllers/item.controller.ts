import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createItemSchema, updateItemSchema } from '../models/item.model';
import { createItem, getUserItems, getItemById, updateItem, deleteItem } from '../services/item.service';

const itemRouter = new Hono();

// 認証が必要なルート
itemRouter.use('/*', authMiddleware);

/**
 * 新しいアイテムを作成
 * POST /api/items
 */
itemRouter.post('/', zValidator('json', createItemSchema), async (c) => {
  try {
    const user = c.get('user');
    const input = c.req.valid('json');

    const item = await createItem(user.id, input);

    return c.json(
      {
        message: 'アイテムが正常に作成されました',
        item,
      },
      201
    );
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('アイテム作成中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * ログインユーザーの全アイテムを取得
 * GET /api/items
 */
itemRouter.get('/', async (c) => {
  try {
    const user = c.get('user');
    const items = await getUserItems(user.id);

    return c.json({
      items,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('アイテム一覧取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 特定のアイテムを取得
 * GET /api/items/:itemId
 */
itemRouter.get('/:itemId', async (c) => {
  try {
    const itemId = parseInt(c.req.param('itemId'), 10);
    if (isNaN(itemId)) {
      throw new HTTPException(400, { message: '無効なアイテムIDです' });
    }

    const item = await getItemById(itemId);

    return c.json({
      item,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('アイテム取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * アイテムを更新
 * PUT /api/items/:itemId
 */
itemRouter.put('/:itemId', zValidator('json', updateItemSchema), async (c) => {
  try {
    const user = c.get('user');
    const itemId = parseInt(c.req.param('itemId'), 10);
    if (isNaN(itemId)) {
      throw new HTTPException(400, { message: '無効なアイテムIDです' });
    }

    const input = c.req.valid('json');
    const item = await updateItem(user.id, itemId, input);

    return c.json({
      message: 'アイテムが正常に更新されました',
      item,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('アイテム更新中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * アイテムを削除
 * DELETE /api/items/:itemId
 */
itemRouter.delete('/:itemId', async (c) => {
  try {
    const user = c.get('user');
    const itemId = parseInt(c.req.param('itemId'), 10);
    if (isNaN(itemId)) {
      throw new HTTPException(400, { message: '無効なアイテムIDです' });
    }

    await deleteItem(user.id, itemId);

    return c.json({
      message: 'アイテムが正常に削除されました',
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('アイテム削除中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

export default itemRouter;
