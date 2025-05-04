import { pgTable, bigserial, varchar, timestamp } from 'drizzle-orm/pg-core';

// tagsテーブルの定義
export const tags = pgTable('tags', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 32 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// タグ関連の型定義
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
