import { db } from '../db';
import { notifications, NewNotification, Notification } from '../db/schema';
import { and, eq, desc, count } from 'drizzle-orm';
import type { UserId, NotificationId } from '../types/branded.d';

export const notificationRepository = {
  /**
   * 新しい通知を作成します。
   * @param newNotification 通知データ
   * @returns 作成された Notification オブジェクト
   */
  async createNotification(newNotification: NewNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(newNotification).returning();
    if (result.length === 0) {
      throw new Error('Failed to create notification or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * ユーザーIDで通知を検索します。
   * @param userId 通知を取得するユーザーID
   * @param limit 取得上限数
   * @param offset 取得開始位置
   * @param readFilter 既読/未読フィルタ (true: 既読, false: 未読, undefined: 全て)
   * @returns 通知オブジェクトの配列
   */
  async findNotificationsByUserId(
    userId: UserId,
    limit: number,
    offset: number,
    readFilter?: boolean
  ): Promise<Notification[]> {
    const conditions = [eq(notifications.userId, userId as number)];
    if (readFilter !== undefined) {
      conditions.push(eq(notifications.isRead, readFilter));
    }

    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  },

  /**
   * 特定の通知を既読にする (リネーム: updateNotificationReadStatus -> markAsRead)
   * @param userId 通知の所有者ID
   * @param notificationId 既読にする通知ID
   * @returns 更新が成功したかどうか (boolean)
   */
  async markAsRead(userId: UserId, notificationId: NotificationId): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId as number)))
      .returning({ id: notifications.id });
    return result.length > 0;
  },

  /**
   * 特定ユーザーのすべての未読通知を既読にする (リネーム: updateAllNotificationsReadStatus -> markAllAsRead)
   * @param userId ユーザーID
   * @returns 更新された通知の件数
   */
  async markAllAsRead(userId: UserId): Promise<number> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId as number), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });
    return result.length;
  },

  /**
   * 未読の通知数をカウントする
   * @param userId ユーザーID
   * @returns 未読通知数
   */
  async countUnreadNotifications(userId: UserId): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId as number), eq(notifications.isRead, false)));
    return result[0].count;
  },
};
