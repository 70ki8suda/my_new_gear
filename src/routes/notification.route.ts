import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../middlewares/auth.middleware';
import { zValidator } from '@hono/zod-validator';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationsCount,
} from '../services/notification.service';
import { notificationsQuerySchema, notificationIdParamSchema } from '../validators/notification.validator';

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
    const query = c.req.valid('query');

    const readFilter = query.read ? query.read === 'true' : undefined;

    const notifications = await getUserNotifications(user.id, query.limit, query.offset, readFilter);
    return c.json({ notifications });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching notifications:', error);
    throw new HTTPException(500, { message: '通知の取得中にエラーが発生しました' });
  }
});

/**
 * 特定の通知を既読にする
 * PUT /api/notifications/:notificationId/read
 */
notificationRouter.put('/:id/read', zValidator('param', notificationIdParamSchema), async (c) => {
  try {
    const user = c.get('user');
    const { id: notificationId } = c.req.valid('param');
    const notification = await markNotificationAsRead(user.id, notificationId);
    return c.json({ message: '通知を既読にしました', notification });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('Error marking notification as read:', error);
    throw new HTTPException(500, { message: '通知の既読処理中にエラーが発生しました' });
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
