import { db } from '../db';
import { items, type NewItem } from '../db/schema';
import { type CreateItemInput, type UpdateItemInput } from '../models/item.model';
import { HTTPException } from 'hono/http-exception';
import { and, eq } from 'drizzle-orm';
import type { UserId, ItemId, PhotoId } from '../types/branded.d';

/**
 * ユーザーのアイテムを作成します
 * @param userId ユーザーID
 * @param input アイテム作成情報
 * @returns 作成されたアイテム
 */
export const createItem = async (userId: UserId, input: CreateItemInput) => {
  const newItem: NewItem = {
    userId: userId as number,
    name: input.name,
    description: input.description,
    defaultPhotoId: input.defaultPhotoId as number | null,
    createdAt: new Date(),
  };

  const result = await db.insert(items).values(newItem).returning();
  return {
    ...result[0],
    id: result[0].id as ItemId,
    userId: result[0].userId as UserId,
    defaultPhotoId: result[0].defaultPhotoId as PhotoId | null,
  };
};

/**
 * ユーザーのアイテム一覧を取得します
 * @param userId ユーザーID
 * @returns アイテム一覧
 */
export const getUserItems = async (userId: UserId) => {
  const userItems = await db
    .select()
    .from(items)
    .where(eq(items.userId, userId as number));
  return userItems.map((item) => ({
    ...item,
    id: item.id as ItemId,
    userId: item.userId as UserId,
    defaultPhotoId: item.defaultPhotoId as PhotoId | null,
  }));
};

/**
 * 指定されたIDのアイテムを取得します
 * @param itemId アイテムID
 * @returns アイテム情報
 */
export const getItemById = async (itemId: ItemId) => {
  const item = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId as number))
    .limit(1);

  if (item.length === 0) {
    throw new HTTPException(404, { message: 'アイテムが見つかりませんでした' });
  }

  return {
    ...item[0],
    id: item[0].id as ItemId,
    userId: item[0].userId as UserId,
    defaultPhotoId: item[0].defaultPhotoId as PhotoId | null,
  };
};

/**
 * 指定されたアイテムを更新します（アイテムの所有者のみ可能）
 * @param userId ユーザーID
 * @param itemId アイテムID
 * @param input 更新情報
 * @returns 更新されたアイテム
 */
export const updateItem = async (userId: UserId, itemId: ItemId, input: UpdateItemInput) => {
  // アイテムが存在し、ユーザーが所有者かチェック
  const existingItem = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId as number), eq(items.userId, userId as number)))
    .limit(1);

  if (existingItem.length === 0) {
    throw new HTTPException(404, { message: 'アイテムが見つかりません、または編集権限がありません' });
  }

  // 更新データの準備
  const updateData = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.defaultPhotoId !== undefined && { defaultPhotoId: input.defaultPhotoId as number | null }),
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
    .where(and(eq(items.id, itemId as number), eq(items.userId, userId as number)))
    .returning();

  return {
    ...updatedItem[0],
    id: updatedItem[0].id as ItemId,
    userId: updatedItem[0].userId as UserId,
    defaultPhotoId: updatedItem[0].defaultPhotoId as PhotoId | null,
  };
};

/**
 * 指定されたアイテムを削除します（アイテムの所有者のみ可能）
 * @param userId ユーザーID
 * @param itemId アイテムID
 * @returns 削除操作の成功状態
 */
export const deleteItem = async (userId: UserId, itemId: ItemId) => {
  // アイテムが存在し、ユーザーが所有者かチェック
  const existingItem = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId as number), eq(items.userId, userId as number)))
    .limit(1);

  if (existingItem.length === 0) {
    throw new HTTPException(404, { message: 'アイテムが見つかりません、または削除権限がありません' });
  }

  // アイテムを削除
  await db.delete(items).where(and(eq(items.id, itemId as number), eq(items.userId, userId as number)));

  return { success: true };
};
