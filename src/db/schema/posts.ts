import { pgTable, bigserial, bigint, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { items } from './items';

// postsテーブルの定義
export const posts = pgTable(
  'posts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    authorId: bigint('author_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    content: varchar('content', { length: 280 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => {
    return {
      // item_id と created_at の複合インデックス
      itemCreatedIdx: index('post_item_created_idx').on(table.itemId, table.createdAt),
    };
  }
);

// 投稿関連の型定義
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
