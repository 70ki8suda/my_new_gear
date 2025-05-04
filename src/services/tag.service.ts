import { db } from '../db';
import { tags } from '../db/schema';
import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import type { TagId } from '../types/branded.d';
import { z } from 'zod';
import { TagIdSchema } from '../types/branded.d';

// タグ情報のZodスキーマ
const TagSchema = z.object({
  id: TagIdSchema,
  name: z.string(),
  createdAt: z.date(),
});

// タグ一覧の戻り値スキーマ
const TagsListSchema = z.array(TagSchema);

/**
 * すべてのタグを取得します
 * @returns タグのリスト
 */
export const getAllTags = async () => {
  try {
    const allTags = await db.query.tags.findMany({
      orderBy: (tags, { asc }) => [asc(tags.name)],
    });

    // 配列全体をまとめてパースする
    const safeTagsList = allTags.map((tag) => ({
      id: tag.id as TagId,
      name: tag.name,
      createdAt: tag.createdAt,
    }));

    try {
      return TagsListSchema.parse(safeTagsList);
    } catch (error) {
      console.error('Failed to parse tags list:', error);
      throw new HTTPException(500, { message: 'タグリスト形式のパースに失敗しました' });
    }
  } catch (error) {
    console.error('Error fetching all tags:', error);
    throw new HTTPException(500, { message: 'タグ一覧の取得中にエラーが発生しました' });
  }
};

/**
 * 指定されたIDのタグを取得します
 * @param tagId 取得するタグのID
 * @returns タグ情報
 */
export const getTagById = async (tagId: TagId) => {
  try {
    const tag = await db.query.tags.findFirst({
      where: eq(tags.id, tagId as number),
    });

    if (!tag) {
      throw new HTTPException(404, { message: '指定されたタグが見つかりません' });
    }

    const safeTag = {
      id: tag.id as TagId,
      name: tag.name,
      createdAt: tag.createdAt,
    };

    try {
      return TagSchema.parse(safeTag);
    } catch (error) {
      console.error('Failed to parse tag:', error);
      throw new HTTPException(500, { message: 'タグ情報形式のパースに失敗しました' });
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching tag:', error);
    throw new HTTPException(500, { message: 'タグの取得中にエラーが発生しました' });
  }
};

// 必要に応じて、タグの作成・更新・削除などの機能を追加
