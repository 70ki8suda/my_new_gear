import { db } from '../db';
import { tags, Tag, NewTag } from '../db/schema';
import { eq, asc, inArray, like } from 'drizzle-orm';
import type { TagId } from '../types/branded.d';

export const tagRepository = {
  /**
   * すべてのタグを名前順 (昇順) で取得します。
   * @returns タグオブジェクトの配列
   */
  async findAllTags(): Promise<Tag[]> {
    return db.query.tags.findMany({
      orderBy: [asc(tags.name)],
    });
  },

  /**
   * タグIDでタグを検索します。
   * @param id 検索するタグID
   * @returns タグオブジェクト、見つからない場合は null
   */
  async findTagById(id: TagId): Promise<Tag | null> {
    const result = await db.query.tags.findFirst({
      where: eq(tags.id, id as number), // Branded Type を number にキャスト
    });
    return result ?? null;
  },

  /**
   * タグ名でタグを検索します (完全一致)。
   * @param name 検索するタグ名
   * @returns タグオブジェクト、見つからない場合は null
   */
  async findTagByName(name: string): Promise<Tag | null> {
    const result = await db.query.tags.findFirst({
      where: eq(tags.name, name),
    });
    return result ?? null;
  },

  /**
   * 新しいタグを作成、または既存のタグを取得します。
   * @param tagName 作成または検索するタグ名
   * @returns 作成または取得されたタグオブジェクト
   */
  async findOrCreateTag(tagName: string): Promise<Tag> {
    const existingTag = await this.findTagByName(tagName);
    if (existingTag) {
      return existingTag;
    }
    // Drizzle v0.29+ は .onConflictDoNothing() や .onConflictDoUpdate() が使えるが、
    // ここでは単純に find -> insert で実装
    const newTagData: NewTag = { name: tagName };
    const result = await db.insert(tags).values(newTagData).returning();
    if (result.length === 0) {
      throw new Error('Failed to create tag or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * 複数のタグIDでタグ情報を一括取得します。
   * @param ids 検索するタグIDの配列
   * @returns タグオブジェクトの配列
   */
  async findTagsByIds(ids: TagId[]): Promise<Tag[]> {
    if (ids.length === 0) {
      return [];
    }
    // TagId[] を number[] にキャスト
    const numericIds = ids as number[];
    // import { inArray } from 'drizzle-orm'; が必要
    return db.select().from(tags).where(inArray(tags.id, numericIds));
  },

  /**
   * タグ名に基づいてタグを検索します。
   * @param query 検索クエリ
   * @param limit 取得上限数 (デフォルト 20)
   * @returns タグオブジェクトの配列
   */
  async searchTagsByQuery(query: string, limit: number = 20): Promise<Tag[]> {
    const searchTerm = `%${query}%`;
    // Tag 型のスキーマに一致するようカラムを取得 (select() のみだと全カラム取得)
    return db.select().from(tags).where(like(tags.name, searchTerm)).limit(limit);
  },

  // TODO: タグに関連するアイテム数を取得するメソッドなど、必要に応じて追加
};
