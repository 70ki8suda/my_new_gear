import { z } from 'zod';
import { UserIdSchema } from '../types/branded.d';

// ユーザーIDパラメータ用スキーマ
export const userIdParamSchema = z.object({ userId: UserIdSchema });

// プロフィール更新用スキーマ
export const updateProfileSchema = z.object({
  bio: z.string().max(1000).optional(), // 最大文字数などの制約
  avatarUrl: z.string().url({ message: '有効なURL形式で入力してください' }).optional(), // URL形式を検証
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
