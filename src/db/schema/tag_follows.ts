import { pgTable, bigint, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { tags } from './tags';

// tag_followsテーブルの定義（ユーザーとタグのフォロー関係）
export const tagFollows = pgTable(
  'tag_follows',
  {
    followerId: bigint('follower_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tagId: bigint('tag_id', { mode: 'number' })
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      // 複合主キー
      pk: primaryKey({ columns: [table.followerId, table.tagId] }),
    };
  }
);

// タグフォロー関連の型定義
export type TagFollow = typeof tagFollows.$inferSelect;
export type NewTagFollow = typeof tagFollows.$inferInsert;
