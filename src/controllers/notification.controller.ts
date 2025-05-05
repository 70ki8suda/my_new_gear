import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../middlewares/auth.middleware';
import { z } from 'zod';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationsCount,
} from '../services/notification.service';
import { zValidator } from '@hono/zod-validator';
import { NotificationIdSchema } from '../types/branded.d';

// --- クエリパラメータ検証スキーマ ---
const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// --- パラメータ検証スキーマ ---
const notificationIdParamSchema = z.object({
  notificationId: NotificationIdSchema,
});

const notificationRouter = new Hono();

// すべての通知エンドポイントには認証が必要
notificationRouter.use('/*', authMiddleware);

/**
 * 未読の通知数を取得
 * GET /api/notifications/unread/count
 */
notificationRouter.get('/unread/count', async (c) => {
  try {
    const user = c.get('user');

    const result = await getUnreadNotificationsCount(user.id);

    return c.json(result);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('未読通知数取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 通知一覧を取得
 * GET /api/notifications
 */
notificationRouter.get('/', zValidator('query', notificationsQuerySchema), async (c) => {
  try {
    const user = c.get('user');
    const { limit, offset } = c.req.valid('query');

    const notifications = await getUserNotifications(user.id, limit, offset);

    return c.json({
      notifications,
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('通知一覧取得中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * 特定の通知を既読にする
 * PUT /api/notifications/:notificationId/read
 */
notificationRouter.put('/:notificationId/read', zValidator('param', notificationIdParamSchema), async (c) => {
  try {
    const user = c.get('user');
    const { notificationId } = c.req.valid('param');

    const result = await markNotificationAsRead(user.id, notificationId);

    return c.json(result);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('通知既読処理中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

/**
 * すべての通知を既読にする
 * PUT /api/notifications/read-all
 */
notificationRouter.put('/read-all', async (c) => {
  try {
    const user = c.get('user');

    const result = await markAllNotificationsAsRead(user.id);

    return c.json(result);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('全通知既読処理中にエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
});

export default notificationRouter;
