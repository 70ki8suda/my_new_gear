import { db } from '../db';
import { items, type NewItem } from '../db/schema';
import { type CreateItemInput, type UpdateItemInput } from '../models/item.model';
import { HTTPException } from 'hono/http-exception';
import { and, eq } from 'drizzle-orm';

/**
 * ユーザーのアイテムを作成します
 * @param userId ユーザーID
 * @param input アイテム作成情報
 * @returns 作成されたアイテム
 */
export const createItem = async (userId: number, input: CreateItemInput) => {
  const newItem: NewItem = {
    userId,
    name: input.name,
    description: input.description,
    defaultPhotoId: input.defaultPhotoId,
    createdAt: new Date(),
  };

  const result = await db.insert(items).values(newItem).returning();
  return result[0];
};

/**
 * ユーザーのアイテム一覧を取得します
 * @param userId ユーザーID
 * @returns アイテム一覧
 */
export const getUserItems = async (userId: number) => {
  const userItems = await db.select().from(items).where(eq(items.userId, userId));
  return userItems;
};

/**
 * 指定されたIDのアイテムを取得します
 * @param itemId アイテムID
 * @returns アイテム情報
 */
export const getItemById = async (itemId: number) => {
  const item = await db.select().from(items).where(eq(items.id, itemId)).limit(1);

  if (item.length === 0) {
    throw new HTTPException(404, { message: 'アイテムが見つかりませんでした' });
  }

  return item[0];
};

/**
 * 指定されたアイテムを更新します（アイテムの所有者のみ可能）
 * @param userId ユーザーID
 * @param itemId アイテムID
 * @param input 更新情報
 * @returns 更新されたアイテム
 */
export const updateItem = async (userId: number, itemId: number, input: UpdateItemInput) => {
  // アイテムが存在し、ユーザーが所有者かチェック
  const existingItem = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))
    .limit(1);

  if (existingItem.length === 0) {
    throw new HTTPException(404, { message: 'アイテムが見つかりません、または編集権限がありません' });
  }

  // 更新データの準備
  const updateData = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.defaultPhotoId !== undefined && { defaultPhotoId: input.defaultPhotoId }),
    updatedAt: new Date(),
  };

  // データが空でないことを確認
  if (Object.keys(updateData).length <= 1) {
    // updatedAtだけの場合
    throw new HTTPException(400, { message: '更新するデータが指定されていません' });
  }

  // アイテムを更新
  const updatedItem = await db
    .update(items)
    .set(updateData)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))
    .returning();

  return updatedItem[0];
};

/**
 * 指定されたアイテムを削除します（アイテムの所有者のみ可能）
 * @param userId ユーザーID
 * @param itemId アイテムID
 * @returns 削除操作の成功状態
 */
export const deleteItem = async (userId: number, itemId: number) => {
  // アイテムが存在し、ユーザーが所有者かチェック
  const existingItem = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))
    .limit(1);

  if (existingItem.length === 0) {
    throw new HTTPException(404, { message: 'アイテムが見つかりません、または削除権限がありません' });
  }

  // アイテムを削除
  await db.delete(items).where(and(eq(items.id, itemId), eq(items.userId, userId)));

  return { success: true };
};
