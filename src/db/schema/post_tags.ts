import { pgTable, bigint, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { posts } from './posts';
import { tags } from './tags';

// post_tagsテーブルの定義（投稿とタグの多対多関係）
export const postTags = pgTable(
  'post_tags',
  {
    postId: bigint('post_id', { mode: 'number' })
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    tagId: bigint('tag_id', { mode: 'number' })
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.postId, table.tagId] }),
    };
  }
);

// 投稿タグ関連の型定義
export type PostTag = typeof postTags.$inferSelect;
export type NewPostTag = typeof postTags.$inferInsert;
