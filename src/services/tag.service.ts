import { HTTPException } from 'hono/http-exception';
import type { TagId } from '../types/branded.d';
import { z } from 'zod';
import { TagIdSchema } from '../types/branded.d';
import { tagRepository } from '../repositories/tag.repository';

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
    const allTags = await tagRepository.findAllTags();

    // リポジトリから取得したデータが Tag[] 型であることを想定
    // 必要に応じて TagId へのキャストを行う
    const safeTagsList = allTags.map((tag) => ({
      ...tag,
      id: tag.id as TagId, // TagId として明示的にキャスト
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
    const tag = await tagRepository.findTagById(tagId);

    if (!tag) {
      throw new HTTPException(404, { message: '指定されたタグが見つかりません' });
    }

    // リポジトリから取得したデータが Tag 型であることを想定
    const safeTag = {
      ...tag,
      id: tag.id as TagId, // TagId として明示的にキャスト
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
    throw new HTTPException(500, { message: 'タグの取得中に予期せぬエラーが発生しました' });
  }
};

// 必要に応じて、タグの作成・更新・削除などの機能を追加
