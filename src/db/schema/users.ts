import { pgTable, bigserial, varchar, text, timestamp } from 'drizzle-orm/pg-core';

// usersテーブルの定義
export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// ユーザー関連の型定義
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
