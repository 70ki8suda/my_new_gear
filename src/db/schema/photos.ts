import { pgTable, bigserial, bigint, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { posts } from './posts';
import { items } from './items';

// photosテーブルの定義
export const photos = pgTable('photos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  postId: bigint('post_id', { mode: 'number' }).references(() => posts.id, { onDelete: 'cascade' }),
  itemId: bigint('item_id', { mode: 'number' }).references(() => items.id),
  uploaderId: bigint('uploader_id', { mode: 'number' })
    .notNull()
    .references(() => users.id),
  url: text('url').notNull(),
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 写真関連の型定義
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
