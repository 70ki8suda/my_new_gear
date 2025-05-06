import { z } from 'zod';

// コメント作成用スキーマ
export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, { message: 'コメント内容を入力してください' })
    .max(140, { message: 'コメントは140文字以内で入力してください' }),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
