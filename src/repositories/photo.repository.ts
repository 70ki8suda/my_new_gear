import { db } from '../db';
import { photos, NewPhoto, Photo } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { PhotoId } from '../types/branded.d';

export const photoRepository = {
  /**
   * 写真IDで写真情報を検索します。
   * @param id 検索する写真ID
   * @returns 写真オブジェクト、見つからない場合は null
   */
  async findPhotoById(id: PhotoId): Promise<Photo | null> {
    const result = await db.query.photos.findFirst({
      where: eq(photos.id, id as number),
    });
    return result ?? null;
  },

  /**
   * 新しい写真情報をデータベースに保存します。
   * @param newPhoto 保存する写真データ
   * @returns 保存された写真オブジェクト
   */
  async createPhoto(newPhoto: NewPhoto): Promise<Photo> {
    const result = await db.insert(photos).values(newPhoto).returning();
    if (result.length === 0) {
      throw new Error('Failed to create photo or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * 複数の写真IDで写真情報を一括取得します。
   * @param ids 検索する写真IDの配列
   * @returns 写真オブジェクトの配列
   */
  async findPhotosByIds(ids: PhotoId[]): Promise<Photo[]> {
    if (ids.length === 0) {
      return [];
    }
    const numericIds = ids as number[];
    return db.select().from(photos).where(inArray(photos.id, numericIds));
  },

  // TODO: 必要に応じて、投稿IDやアイテムIDに紐づく写真を取得するメソッドなどを追加
};
