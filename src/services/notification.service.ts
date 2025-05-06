import { db } from '../db';
import {
  notifications,
  users,
  posts,
  comments,
  NOTIFICATION_TYPES,
  type NotificationType,
  Notification,
  NewNotification,
  Post,
  Tag,
} from '../db/schema';
import { HTTPException } from 'hono/http-exception';
import { and, eq, desc, sql, or, inArray, count } from 'drizzle-orm';
import type { UserId, PostId, CommentId, TagId, NotificationId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, NotificationIdSchema } from '../types/branded.d';
import { notificationRepository } from '../repositories/notification.repository';
import { userRepository } from '../repositories/user.repository';
import { postRepository } from '../repositories/post.repository';
import { tagRepository } from '../repositories/tag.repository';
import console from 'console';
import type { User } from '../db/schema';

// 通知の詳細情報のスキーマ
const NotificationSchema = z.object({
  id: NotificationIdSchema,
  type: z.nativeEnum(NOTIFICATION_TYPES),
  createdAt: z.date(),
  isRead: z.boolean(),
  actor: z
    .object({
      id: UserIdSchema,
      username: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
  subject: z
    .union([
      z.object({ type: z.literal('post'), id: z.number(), content: z.string() }),
      z.object({ type: z.literal('tag'), id: z.number(), name: z.string() }),
      z.null(),
    ])
    .nullable(),
});

// 通知一覧の戻り値スキーマ
const NotificationsListSchema = z.array(NotificationSchema);

/**
 * 内部ヘルパー: 通知作成の共通ロジック (ここに移動)
 */
const _createNotificationHelper = async (notificationData: Omit<NewNotification, 'createdAt'>) => {
  try {
    const newNotification = {
      ...notificationData,
      createdAt: new Date(), // 作成時刻はここで設定
    };
    // リポジトリ経由で通知を作成
    return await notificationRepository.createNotification(newNotification);
  } catch (error) {
    console.error(`通知作成中にエラー (${notificationData.type}):`, error);
    return null; // エラー時は null を返す
  }
};

/**
 * ユーザーフォロー通知を作成します
 * @param userId 通知を受け取るユーザーID
 * @param actorId フォローしたユーザーID
 * @returns 作成された通知 or null
 */
export const createFollowerNotification = async (userId: UserId, actorId: UserId): Promise<Notification | null> => {
  if (userId === actorId) {
    // 自分自身をフォローした場合は通知しない
    return null;
  }

  return _createNotificationHelper({
    userId: userId,
    type: NOTIFICATION_TYPES.FOLLOWER,
    actorId: actorId,
    subjectId: null,
  });
};

/**
 * いいね通知を作成します
 * @param postAuthorId 投稿者のユーザーID
 * @param actorId いいねしたユーザーID
 * @param postId いいねされた投稿ID
 * @returns 作成された通知 or null
 */
export const createLikeNotification = async (
  postAuthorId: UserId,
  actorId: UserId,
  postId: PostId
): Promise<Notification | null> => {
  if (postAuthorId === actorId) {
    // 自分の投稿にいいねした場合は通知しない
    return null;
  }

  return _createNotificationHelper({
    userId: postAuthorId,
    type: NOTIFICATION_TYPES.LIKE,
    actorId: actorId,
    subjectId: postId,
  });
};

/**
 * コメント通知を作成します
 * @param postAuthorId 投稿者のユーザーID
 * @param actorId コメントしたユーザーID
 * @param postId コメントされた投稿ID
 * @returns 作成された通知 or null
 */
export const createCommentNotification = async (
  postAuthorId: UserId,
  actorId: UserId,
  postId: PostId
): Promise<Notification | null> => {
  if (postAuthorId === actorId) {
    // 自分の投稿にコメントした場合は通知しない
    return null;
  }

  return _createNotificationHelper({
    userId: postAuthorId,
    type: NOTIFICATION_TYPES.COMMENT,
    actorId: actorId,
    subjectId: postId,
  });
};

/**
 * タグフォロー通知を作成します (タグ所有者がいる場合)
 * @param tagOwnerId タグ所有者のユーザーID
 * @param actorId フォローしたユーザーID
 * @param tagId フォローされたタグID
 * @returns 作成された通知 or null
 */
export const createTagFollowNotification = async (
  tagOwnerId: UserId | null,
  actorId: UserId,
  tagId: TagId
): Promise<Notification | null> => {
  if (!tagOwnerId || tagOwnerId === actorId) return null;

  return _createNotificationHelper({
    userId: tagOwnerId,
    type: NOTIFICATION_TYPES.TAG_FOLLOW,
    actorId: actorId,
    subjectId: tagId,
  });
};

/**
 * ユーザーの通知一覧を取得します
 * @param userId 通知を取得するユーザーID
 * @param limit 取得する通知数の上限（デフォルト20件）
 * @param offset ページネーション用のオフセット（デフォルト0）
 * @param readFilter 既読/未読でフィルタリングする場合 (true: 既読のみ, false: 未読のみ, undefined: 全て)
 * @returns 通知リスト (関連情報付き)
 */
export const getUserNotifications = async (userId: UserId, limit = 20, offset = 0, readFilter?: boolean) => {
  // 1. リポジトリから基本通知リストを取得
  const notificationsBase = await notificationRepository.findNotificationsByUserId(userId, limit, offset, readFilter);
  if (notificationsBase.length === 0) {
    return [];
  }

  // 2. 関連情報を取得するための ID を収集
  const actorIds: UserId[] = [];
  const postSubjectIds: PostId[] = [];
  const tagSubjectIds: TagId[] = [];
  // TODO: 他の subject type があれば追加

  notificationsBase.forEach((n) => {
    if (n.actorId) actorIds.push(n.actorId as UserId);
    if (n.subjectId) {
      switch (n.type) {
        case NOTIFICATION_TYPES.LIKE:
        case NOTIFICATION_TYPES.COMMENT:
          postSubjectIds.push(n.subjectId as PostId);
          break;
        case NOTIFICATION_TYPES.TAG_FOLLOW:
          tagSubjectIds.push(n.subjectId as TagId);
          break;
        // 他のタイプも処理
      }
    }
  });

  // 重複を除去
  const uniqueActorIds = [...new Set(actorIds)];
  const uniquePostSubjectIds = [...new Set(postSubjectIds)];
  const uniqueTagSubjectIds = [...new Set(tagSubjectIds)];

  // 3. 関連情報を一括取得 (型を明示)
  const [actorsData, postsData, tagsData] = await Promise.all([
    uniqueActorIds.length > 0 ? userRepository.findUsersByIds(uniqueActorIds) : Promise.resolve([] as User[]),
    uniquePostSubjectIds.length > 0
      ? postRepository.findPostsByIds(uniquePostSubjectIds)
      : Promise.resolve([] as Post[]),
    uniqueTagSubjectIds.length > 0 ? tagRepository.findTagsByIds(uniqueTagSubjectIds) : Promise.resolve([] as Tag[]),
    // TODO: 他の subject type の情報取得
  ]);

  // 取得した情報を Map にして高速アクセス可能にする (型が推論されるはず)
  const actorMap = new Map(actorsData.map((u) => [u.id as UserId, u]));
  const postMap = new Map(postsData.map((p) => [p.id as PostId, p]));
  const tagMap = new Map(tagsData.map((t) => [t.id as TagId, t]));

  // 4. 通知リストと関連情報を結合
  const notificationsWithDetails = notificationsBase.map((n) => {
    const actorInfo = n.actorId ? actorMap.get(n.actorId as UserId) : null;
    let subjectInfo: z.infer<typeof NotificationSchema>['subject'] = null; // 型を明示

    if (n.subjectId) {
      switch (n.type) {
        case NOTIFICATION_TYPES.LIKE:
        case NOTIFICATION_TYPES.COMMENT:
          const post = postMap.get(n.subjectId as PostId);
          if (post) {
            subjectInfo = { type: 'post', id: post.id, content: post.content };
          }
          break;
        case NOTIFICATION_TYPES.TAG_FOLLOW:
          const tag = tagMap.get(n.subjectId as TagId);
          if (tag) {
            subjectInfo = { type: 'tag', id: tag.id, name: tag.name };
          }
          break;
        // 他のタイプも処理
      }
    }

    // NotificationSchema に合わせて整形
    const parsedActor = z
      .object({ id: UserIdSchema, username: z.string(), avatarUrl: z.string().nullable() })
      .nullable()
      .safeParse(actorInfo);

    return {
      id: n.id as NotificationId,
      type: n.type as NotificationType,
      createdAt: n.createdAt,
      isRead: n.isRead,
      actor: parsedActor.success ? parsedActor.data : null,
      subject: subjectInfo, // 既に整形済み
    };
  });

  // 5. Zod で最終パース
  try {
    // 注意: NotificationSchema の subject 定義が実際のデータ構造と一致している必要がある
    return NotificationsListSchema.parse(notificationsWithDetails);
  } catch (error) {
    console.error('Failed to parse notifications list with details:', error);
    // エラー詳細をログに出力
    if (error instanceof z.ZodError) {
      console.error('Zod Errors:', JSON.stringify(error.errors, null, 2));
    }
    throw new HTTPException(500, { message: '通知リスト形式のパースに失敗しました' });
  }
};

/**
 * 通知を既読にします
 * @param userId 通知の所有者ID
 * @param notificationId 既読にする通知ID
 * @returns 更新結果 { success: true } or throws error
 */
export const markNotificationAsRead = async (userId: UserId, notificationId: NotificationId) => {
  // try {
  // const result = await db
  //   .update(notifications)
  //   .set({ isRead: true })
  //   .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId as number)))
  //   .returning({ id: notifications.id });
  // if (result.length === 0) {
  //   throw new HTTPException(404, { message: '該当する通知が見つかりません' });
  // }
  // return { success: true };
  // } catch (error) {
  //   if (error instanceof HTTPException) throw error;
  //   console.error('Error marking notification as read:', error);
  //   throw new HTTPException(500, { message: '通知の既読処理中にエラーが発生しました' });
  // }
  const success = await notificationRepository.markAsRead(userId, notificationId);
  if (!success) {
    // 自分のものではないか、IDが存在しない場合
    throw new HTTPException(404, { message: '該当する通知が見つからないか、権限がありません' });
  }
  return { success: true };
};

/**
 * すべての通知を既読にします
 * @param userId 通知の所有者ID
 * @returns 更新結果 { success: true, count: number }
 */
export const markAllNotificationsAsRead = async (userId: UserId) => {
  // try {
  //   await db
  //     .update(notifications)
  //     .set({ isRead: true })
  //     .where(and(eq(notifications.userId, userId as number), eq(notifications.isRead, false)));
  //   return { success: true };
  // } catch (error) {
  //   console.error('Error marking all notifications as read:', error);
  //   throw new HTTPException(500, { message: 'すべての通知の既読処理中にエラーが発生しました' });
  // }
  const updatedCount = await notificationRepository.markAllAsRead(userId);
  // 更新件数が 0 でもエラーではない
  return { success: true, count: updatedCount };
};

/**
 * 未読の通知数を取得します
 * @param userId ユーザーID
 * @returns 未読通知数 { count: number }
 */
export const getUnreadNotificationsCount = async (userId: UserId) => {
  // try {
  //   const result = await db
  //     .select({ count: sql`count(*)`.mapWith(Number) })
  //     .from(notifications)
  //     .where(and(eq(notifications.userId, userId as number), eq(notifications.isRead, false)));
  //   return { count: result[0].count };
  // } catch (error) {
  //   console.error('Error getting unread notifications count:', error);
  //   throw new HTTPException(500, { message: '未読通知数の取得中にエラーが発生しました' });
  // }
  const count = await notificationRepository.countUnreadNotifications(userId);
  return { count };
};
