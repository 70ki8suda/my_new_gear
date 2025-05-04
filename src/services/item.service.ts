import { db } from '../db';
import { items, type NewItem } from '../db/schema';
import { type CreateItemInput, type UpdateItemInput } from '../models/item.model';
import { HTTPException } from 'hono/http-exception';
import { and, eq } from 'drizzle-orm';
import type { UserId, ItemId, PhotoId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, ItemIdSchema, PhotoIdSchema } from '../types/branded.d';

// アイテム戻り値のZodスキーマ
const ItemSchema = z.object({
  id: ItemIdSchema,
  userId: UserIdSchema,
  name: z.string(),
  description: z.string().nullable(),
  defaultPhotoId: PhotoIdSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

// deleteItem の戻り値スキーマ
const DeleteResultSchema = z.object({ success: z.literal(true) });

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
  const itemObject = {
    // DBからの戻り値を整形
    id: result[0].id,
    userId: result[0].userId,
    name: result[0].name,
    description: result[0].description,
    defaultPhotoId: result[0].defaultPhotoId,
    createdAt: result[0].createdAt,
    updatedAt: result[0].updatedAt,
  };

  try {
    return ItemSchema.parse(itemObject);
  } catch (error) {
    console.error('Failed to parse created item:', error);
    throw new HTTPException(500, { message: 'アイテム作成後のデータ形式エラー' });
  }
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

  // 各アイテムをパースして返す (失敗したものは除外)
  return userItems
    .map((item) => {
      const itemObject = {
        // DBからの戻り値を整形
        id: item.id,
        userId: item.userId,
        name: item.name,
        description: item.description,
        defaultPhotoId: item.defaultPhotoId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
      try {
        return ItemSchema.parse(itemObject);
      } catch (error) {
        console.error(`Failed to parse item ID ${item.id}:`, error);
        return null;
      }
    })
    .filter((item): item is z.infer<typeof ItemSchema> => item !== null);
};

/**
 * 指定されたIDのアイテムを取得します
 * @param itemId アイテムID
 * @returns アイテム情報
 */
export const getItemById = async (itemId: ItemId) => {
  const itemResult = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId as number))
    .limit(1);

  if (itemResult.length === 0) {
    throw new HTTPException(404, { message: 'アイテムが見つかりませんでした' });
  }
  const item = itemResult[0];
  const itemObject = {
    // DBからの戻り値を整形
    id: item.id,
    userId: item.userId,
    name: item.name,
    description: item.description,
    defaultPhotoId: item.defaultPhotoId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };

  try {
    return ItemSchema.parse(itemObject);
  } catch (error) {
    console.error(`Failed to parse item ID ${itemId}:`, error);
    throw new HTTPException(500, { message: 'アイテム取得後のデータ形式エラー' });
  }
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
  const updatedItemArray = await db
    .update(items)
    .set(updateData)
    .where(and(eq(items.id, itemId as number), eq(items.userId, userId as number)))
    .returning();

  if (updatedItemArray.length === 0) {
    // 通常ここには来ないはず (存在チェックで弾かれるため)
    throw new HTTPException(404, { message: '更新対象のアイテムが見つかりませんでした' });
  }
  const updatedItem = updatedItemArray[0];
  const itemObject = {
    // DBからの戻り値を整形
    id: updatedItem.id,
    userId: updatedItem.userId,
    name: updatedItem.name,
    description: updatedItem.description,
    defaultPhotoId: updatedItem.defaultPhotoId,
    createdAt: updatedItem.createdAt,
    updatedAt: updatedItem.updatedAt,
  };

  try {
    return ItemSchema.parse(itemObject);
  } catch (error) {
    console.error(`Failed to parse updated item ID ${itemId}:`, error);
    throw new HTTPException(500, { message: 'アイテム更新後のデータ形式エラー' });
  }
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

  // 戻り値をスキーマで parse (形式を保証するため)
  try {
    return DeleteResultSchema.parse({ success: true });
  } catch (error) {
    // 基本的にこのパースは失敗しないはずだが念のため
    console.error('Failed to parse delete result:', error);
    throw new HTTPException(500, { message: 'アイテム削除後の内部エラー' });
  }
};
