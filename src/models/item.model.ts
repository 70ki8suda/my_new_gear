import { z } from 'zod';
import { PhotoIdSchema } from '../types/branded.d';

// アイテム作成用スキーマ
export const createItemSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'アイテム名を入力してください' })
    .max(64, { message: 'アイテム名は64文字以内で入力してください' }),
  description: z.string().max(1000, { message: '説明は1000文字以内で入力してください' }).optional(),
  defaultPhotoId: PhotoIdSchema.optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

// アイテム更新用スキーマ
export const updateItemSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'アイテム名を入力してください' })
    .max(64, { message: 'アイテム名は64文字以内で入力してください' })
    .optional(),
  description: z.string().max(1000, { message: '説明は1000文字以内で入力してください' }).optional(),
  defaultPhotoId: PhotoIdSchema.optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;
