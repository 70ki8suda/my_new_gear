import { db } from '../db';
import { items, type NewItem } from '../db/schema';
import { type CreateItemInput, type UpdateItemInput } from '../validators/item.model';
import { HTTPException } from 'hono/http-exception';
import { and, eq } from 'drizzle-orm';
import type { UserId, ItemId, PhotoId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, ItemIdSchema, PhotoIdSchema } from '../types/branded.d';
import { itemRepository } from '../repositories/item.repository';

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
    defaultPhotoId: input.defaultPhotoId,
  };

  const createdItem = await itemRepository.createItem(newItem);

  const itemObject = {
    id: createdItem.id,
    userId: createdItem.userId,
    name: createdItem.name,
    description: createdItem.description,
    defaultPhotoId: createdItem.defaultPhotoId,
    createdAt: createdItem.createdAt,
    updatedAt: createdItem.updatedAt,
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
  const userItems = await itemRepository.findItemsByUserId(userId);

  return userItems
    .map((item) => {
      const itemObject = {
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
  const item = await itemRepository.findItemById(itemId);

  if (!item) {
    throw new HTTPException(404, { message: 'アイテムが見つかりませんでした' });
  }
  const itemObject = {
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
  const updateData = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.defaultPhotoId !== undefined && { defaultPhotoId: input.defaultPhotoId as number | null }),
  };

  if (!updateData.name && !updateData.description && updateData.defaultPhotoId === undefined) {
    throw new HTTPException(400, { message: '更新するデータが指定されていません' });
  }

  const updatedItem = await itemRepository.updateItem(itemId, updateData, userId);

  if (!updatedItem) {
    throw new HTTPException(404, { message: 'アイテムが見つからないか、更新権限がありません' });
  }
  const itemObject = {
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
  const success = await itemRepository.deleteItem(itemId, userId);

  if (!success) {
    throw new HTTPException(404, { message: 'アイテムが見つからないか、削除権限がありません' });
  }

  try {
    return DeleteResultSchema.parse({ success: true });
  } catch (error) {
    console.error('Failed to parse delete result:', error);
    throw new HTTPException(500, { message: 'アイテム削除後の内部エラー' });
  }
};
