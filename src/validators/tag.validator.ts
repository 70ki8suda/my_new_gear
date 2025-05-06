import { z } from 'zod';
import { TagIdSchema } from '../types/branded.d';

// タグIDパラメータ用スキーマ
export const tagIdParamSchema = z.object({
  tagId: TagIdSchema,
});

// タグ名パラメータ用スキーマ (例: /api/tags/:tagName/follow)
export const tagNameParamSchema = z.object({
  tagName: z.string().min(1).max(32), // タグ名の制約に合わせる
});

// タグ作成用スキーマ (もしあれば)
// export const createTagSchema = z.object({ ... });

// タグ更新用スキーマ (もしあれば)
// export const updateTagSchema = z.object({ ... });
