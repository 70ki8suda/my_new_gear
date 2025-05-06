import { z } from 'zod';
import { NotificationIdSchema } from '../types/branded.d'; // 必要に応じてインポート

// 通知一覧取得時のクエリパラメータ用スキーマ
export const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  read: z.enum(['true', 'false']).optional(), // クエリパラメータは文字列なので enum で判定
});

// 通知IDパラメータ用スキーマ
export const notificationIdParamSchema = z.object({
  id: NotificationIdSchema, // URLパラメータも branded type で検証
});
