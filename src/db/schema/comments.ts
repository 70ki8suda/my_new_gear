import { pgTable, bigserial, bigint, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { posts } from './posts';

// commentsテーブルの定義
export const comments = pgTable(
  'comments',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    postId: bigint('post_id', { mode: 'number' })
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: bigint('author_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    content: varchar('content', { length: 140 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      // post_id と created_at の複合インデックス（昇順）
      postCreatedIdx: index('comment_post_created_idx').on(table.postId, table.createdAt),
    };
  }
);

// コメント関連の型定義
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
