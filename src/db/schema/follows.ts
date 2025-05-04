import { pgTable, bigint, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

// followsテーブルの定義（ユーザー間のフォロー関係）
export const follows = pgTable(
  'follows',
  {
    followerId: bigint('follower_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followeeId: bigint('followee_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      // 複合主キー
      pk: primaryKey({ columns: [table.followerId, table.followeeId] }),
    };
  }
);

// フォロー関連の型定義
export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;
