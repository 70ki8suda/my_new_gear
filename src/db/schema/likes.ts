import { pgTable, bigint, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { posts } from './posts';

// likesテーブルの定義（ユーザーが投稿にいいねする関係）
export const likes = pgTable(
  'likes',
  {
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: bigint('post_id', { mode: 'number' })
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      // 複合主キー
      pk: primaryKey({ columns: [table.userId, table.postId] }),
    };
  }
);

// いいね関連の型定義
export type Like = typeof likes.$inferSelect;
export type NewLike = typeof likes.$inferInsert;
