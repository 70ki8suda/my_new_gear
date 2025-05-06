import { db } from '../db';
import { items, NewItem, Item } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { UserId, ItemId } from '../types/branded.d'; // 必要に応じて Branded Types を使用

// 更新用の型を定義
type UpdateItemPayload = Partial<Pick<Item, 'name' | 'description' | 'defaultPhotoId'>>;

export const itemRepository = {
  /**
   * 新しいアイテムを作成します。
   * @param newItem 作成するアイテムデータ (NewItem 型)
   * @returns 作成されたアイテムオブジェクト (Item 型)
   */
  async createItem(newItem: NewItem): Promise<Item> {
    const result = await db.insert(items).values(newItem).returning();
    if (result.length === 0) {
      throw new Error('Failed to create item or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * アイテムIDでアイテムを検索します。
   * @param itemId 検索するアイテムID
   * @returns アイテムオブジェクト、見つからない場合は null
   */
  async findItemById(itemId: ItemId): Promise<Item | null> {
    const result = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
    return result[0] ?? null;
  },

  /**
   * ユーザーIDでそのユーザーが所有するアイテム一覧を取得します。
   * @param userId 検索するユーザーID
   * @returns アイテムオブジェクトの配列
   */
  async findItemsByUserId(userId: UserId): Promise<Item[]> {
    const result = await db.select().from(items).where(eq(items.userId, userId));
    return result;
  },

  /**
   * アイテムを更新します。
   * @param itemId 更新するアイテムID
   * @param itemUpdates 更新内容 (UpdateItem 型)
   * @param userId 所有者確認のためのユーザーID
   * @returns 更新されたアイテムオブジェクト、見つからない/権限がない場合は null
   */
  async updateItem(itemId: ItemId, itemUpdates: UpdateItemPayload, userId: UserId): Promise<Item | null> {
    // NOTE: Drizzle doesn't directly support returning the updated row for UPDATE
    // based on a condition like matching userId in the WHERE clause combined with the ID.
    // We might need a transaction or separate select after update.
    // For simplicity here, let's assume the update happens and re-select.

    // First, check if the item exists and belongs to the user
    const existingItem = await this.findItemById(itemId);
    if (!existingItem || existingItem.userId !== userId) {
      return null; // Not found or not authorized
    }

    // Perform the update
    await db
      .update(items)
      .set({ ...itemUpdates, updatedAt: new Date() }) // Add updatedAt timestamp
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));

    // Re-fetch the updated item
    const updatedItem = await this.findItemById(itemId);
    return updatedItem;

    /* Alternative approach if returning() worked with complex WHERE:
    const result = await db.update(items)
      .set(itemUpdates)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)))
      .returning();
    return result[0] ?? null;
    */
  },

  /**
   * アイテムを削除します。
   * @param itemId 削除するアイテムID
   * @param userId 所有者確認のためのユーザーID
   * @returns 削除に成功した場合は true, アイテムが見つからない/権限がない場合は false
   */
  async deleteItem(itemId: ItemId, userId: UserId): Promise<boolean> {
    const result = await db
      .delete(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)))
      .returning({ id: items.id }); // Check if any row was actually deleted

    return result.length > 0;
  },

  // TODO: Add methods for tag association if needed (e.g., addItemTag, removeItemTag)
};
