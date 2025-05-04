import { pgTable, bigint, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { items } from './items';
import { tags } from './tags';

// item_tagsテーブル（M:M関連）の定義
export const itemTags = pgTable(
  'item_tags',
  {
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    tagId: bigint('tag_id', { mode: 'number' })
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      // 複合主キーの設定
      pk: primaryKey({ columns: [table.itemId, table.tagId] }),
    };
  }
);

// タグ付け関連の型定義
export type ItemTag = typeof itemTags.$inferSelect;
export type NewItemTag = typeof itemTags.$inferInsert;
