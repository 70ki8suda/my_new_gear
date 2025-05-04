import { z } from 'zod';

// ポスト作成用スキーマ
export const createPostSchema = z.object({
  itemId: z.number().int().positive({ message: '有効なアイテムIDを指定してください' }),
  content: z
    .string()
    .min(1, { message: '投稿内容を入力してください' })
    .max(280, { message: '投稿内容は280文字以内で入力してください' }),
  // photos: z.array(z.string().url({ message: '有効な画像URLを指定してください' })).max(4).optional(), // 写真機能は後で追加
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// ポスト更新用スキーマ (今回は更新機能は不要なのでコメントアウト)
/*
export const updatePostSchema = z.object({
  content: z
    .string()
    .min(1, { message: '投稿内容を入力してください' })
    .max(280, { message: '投稿内容は280文字以内で入力してください' })
    .optional(),
  // photos: z.array(z.string().url({ message: '有効な画像URLを指定してください' })).max(4).optional(),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;
*/
