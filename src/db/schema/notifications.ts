import { pgTable, bigserial, bigint, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

// 通知タイプの定義
export const NOTIFICATION_TYPES = {
  FOLLOWER: 'follower',
  LIKE: 'like',
  COMMENT: 'comment',
  TAG_FOLLOW: 'tag_follow',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// notificationsテーブルの定義
export const notifications = pgTable('notifications', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 16 }).notNull(),
  actorId: bigint('actor_id', { mode: 'number' }).references(() => users.id),
  subjectId: bigint('subject_id', { mode: 'number' }), // 投稿ID、コメントIDなどのコンテキスト
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  isRead: boolean('is_read').default(false),
});

// 通知関連の型定義
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
