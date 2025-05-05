import { db } from '../db';
import { notifications, users, posts, comments, NOTIFICATION_TYPES, type NotificationType } from '../db/schema';
import { HTTPException } from 'hono/http-exception';
import { and, eq, desc, sql, or, inArray } from 'drizzle-orm';
import type { UserId, PostId, CommentId, TagId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, NotificationIdSchema } from '../types/branded.d';

// 通知の詳細情報のスキーマ
const NotificationSchema = z.object({
  id: NotificationIdSchema,
  type: z.string(),
  createdAt: z.date(),
  isRead: z.boolean(),
  actor: z
    .object({
      id: UserIdSchema,
      username: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
  subject: z.record(z.unknown()).nullable(), // 通知タイプに応じて変わる詳細情報
});

// 通知一覧の戻り値スキーマ
const NotificationsListSchema = z.array(NotificationSchema);

/**
 * ユーザーフォロー通知を作成します
 * @param userId 通知を受け取るユーザーID
 * @param actorId フォローしたユーザーID
 * @returns 作成された通知
 */
export const createFollowerNotification = async (userId: UserId, actorId: UserId) => {
  try {
    if (userId === actorId) {
      // 自分自身をフォローした場合は通知しない
      return null;
    }

    const newNotification = {
      userId: userId as number,
      type: NOTIFICATION_TYPES.FOLLOWER,
      actorId: actorId as number,
      createdAt: new Date(),
    };

    const result = await db.insert(notifications).values(newNotification).returning();
    return result[0];
  } catch (error) {
    console.error('フォロー通知作成中にエラーが発生しました:', error);
    // 通知作成のエラーはユーザー体験に直接影響しないため、例外をスローせずにnullを返す
    return null;
  }
};

/**
 * いいね通知を作成します
 * @param postAuthorId 投稿者のユーザーID
 * @param actorId いいねしたユーザーID
 * @param postId いいねされた投稿ID
 * @returns 作成された通知
 */
export const createLikeNotification = async (postAuthorId: UserId, actorId: UserId, postId: PostId) => {
  try {
    if (postAuthorId === actorId) {
      // 自分の投稿にいいねした場合は通知しない
      return null;
    }

    const newNotification = {
      userId: postAuthorId as number,
      type: NOTIFICATION_TYPES.LIKE,
      actorId: actorId as number,
      subjectId: postId as number,
      createdAt: new Date(),
    };

    const result = await db.insert(notifications).values(newNotification).returning();
    return result[0];
  } catch (error) {
    console.error('いいね通知作成中にエラーが発生しました:', error);
    // 通知作成のエラーはユーザー体験に直接影響しないため、例外をスローせずにnullを返す
    return null;
  }
};

/**
 * コメント通知を作成します
 * @param postAuthorId 投稿者のユーザーID
 * @param actorId コメントしたユーザーID
 * @param postId コメントされた投稿ID
 * @returns 作成された通知
 */
export const createCommentNotification = async (postAuthorId: UserId, actorId: UserId, postId: PostId) => {
  try {
    if (postAuthorId === actorId) {
      // 自分の投稿にコメントした場合は通知しない
      return null;
    }

    const newNotification = {
      userId: postAuthorId as number,
      type: NOTIFICATION_TYPES.COMMENT,
      actorId: actorId as number,
      subjectId: postId as number,
      createdAt: new Date(),
    };

    const result = await db.insert(notifications).values(newNotification).returning();
    return result[0];
  } catch (error) {
    console.error('コメント通知作成中にエラーが発生しました:', error);
    // 通知作成のエラーはユーザー体験に直接影響しないため、例外をスローせずにnullを返す
    return null;
  }
};

/**
 * タグフォロー通知を作成します (タグ所有者がいる場合)
 * @param tagOwnerId タグ所有者のユーザーID
 * @param actorId フォローしたユーザーID
 * @param tagId フォローされたタグID
 * @returns 作成された通知
 */
export const createTagFollowNotification = async (tagOwnerId: UserId, actorId: UserId, tagId: TagId) => {
  try {
    if (tagOwnerId === actorId) {
      // 自分のタグをフォローした場合は通知しない
      return null;
    }

    const newNotification = {
      userId: tagOwnerId as number,
      type: NOTIFICATION_TYPES.TAG_FOLLOW,
      actorId: actorId as number,
      subjectId: tagId as number,
      createdAt: new Date(),
    };

    const result = await db.insert(notifications).values(newNotification).returning();
    return result[0];
  } catch (error) {
    console.error('タグフォロー通知作成中にエラーが発生しました:', error);
    // 通知作成のエラーはユーザー体験に直接影響しないため、例外をスローせずにnullを返す
    return null;
  }
};

/**
 * ユーザーの通知一覧を取得します
 * @param userId 通知を取得するユーザーID
 * @param limit 取得する通知数の上限（デフォルト20件）
 * @param offset ページネーション用のオフセット（デフォルト0）
 * @returns 通知リスト
 */
export const getUserNotifications = async (userId: UserId, limit = 20, offset = 0) => {
  try {
    // 基本の通知情報を取得
    const notificationsData = await db
      .select({
        notification: {
          id: notifications.id,
          type: notifications.type,
          createdAt: notifications.createdAt,
          isRead: notifications.isRead,
          actorId: notifications.actorId,
          subjectId: notifications.subjectId,
        },
      })
      .from(notifications)
      .where(eq(notifications.userId, userId as number))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    // 通知に詳細情報を追加
    const notificationsWithDetails = await Promise.all(
      notificationsData.map(async (item) => {
        const notification = item.notification;
        let actor = null;
        let subject = null;

        // アクターユーザー情報を取得
        if (notification.actorId) {
          actor = await db.query.users.findFirst({
            where: eq(users.id, notification.actorId),
            columns: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          });
        }

        // 通知タイプに応じて詳細情報を取得
        if (notification.subjectId) {
          switch (notification.type) {
            case NOTIFICATION_TYPES.LIKE:
            case NOTIFICATION_TYPES.COMMENT:
              // 投稿情報を取得
              const post = await db.query.posts.findFirst({
                where: eq(posts.id, notification.subjectId),
                columns: {
                  id: true,
                  content: true,
                },
              });
              subject = post;
              break;
            // 他の通知タイプも必要に応じて追加
          }
        }

        return {
          id: notification.id,
          type: notification.type,
          createdAt: notification.createdAt,
          isRead: notification.isRead,
          actor,
          subject,
        };
      })
    );

    try {
      return NotificationsListSchema.parse(notificationsWithDetails);
    } catch (error) {
      console.error('Failed to parse notifications list:', error);
      throw new HTTPException(500, { message: '通知リスト形式のパースに失敗しました' });
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching user notifications:', error);
    throw new HTTPException(500, { message: '通知一覧の取得中にエラーが発生しました' });
  }
};

/**
 * 通知を既読にします
 * @param userId 通知の所有者ID
 * @param notificationId 既読にする通知ID
 * @returns 更新結果
 */
export const markNotificationAsRead = async (userId: UserId, notificationId: number) => {
  try {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId as number)))
      .returning({ id: notifications.id });

    if (result.length === 0) {
      throw new HTTPException(404, { message: '該当する通知が見つかりません' });
    }

    return { success: true };
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('Error marking notification as read:', error);
    throw new HTTPException(500, { message: '通知の既読処理中にエラーが発生しました' });
  }
};

/**
 * すべての通知を既読にします
 * @param userId 通知の所有者ID
 * @returns 更新結果
 */
export const markAllNotificationsAsRead = async (userId: UserId) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId as number), eq(notifications.isRead, false)));

    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw new HTTPException(500, { message: 'すべての通知の既読処理中にエラーが発生しました' });
  }
};

/**
 * 未読の通知数を取得します
 * @param userId ユーザーID
 * @returns 未読通知数
 */
export const getUnreadNotificationsCount = async (userId: UserId) => {
  try {
    const result = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(notifications)
      .where(and(eq(notifications.userId, userId as number), eq(notifications.isRead, false)));

    return { count: result[0].count };
  } catch (error) {
    console.error('Error getting unread notifications count:', error);
    throw new HTTPException(500, { message: '未読通知数の取得中にエラーが発生しました' });
  }
};
