import { pgTable, bigserial, bigint, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

// itemsテーブルの定義
export const items = pgTable('items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  defaultPhotoId: bigint('default_photo_id', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// アイテム関連の型定義
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
