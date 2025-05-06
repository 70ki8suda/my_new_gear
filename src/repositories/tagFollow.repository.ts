import { db } from '../db';
import { tagFollows, tags, NewTagFollow, TagFollow } from '../db/schema';
import { and, eq, desc, inArray } from 'drizzle-orm';
import type { UserId, TagId } from '../types/branded.d';
import type { Tag } from '../db/schema';

export const tagFollowRepository = {
  /**
   * ユーザーが特定のタグをフォローしているか確認します。
   * @param followerId ユーザーID
   * @param tagId タグID
   * @returns フォロー関係が存在すれば TagFollow オブジェクト、なければ null
   */
  async findTagFollow(followerId: UserId, tagId: TagId): Promise<TagFollow | null> {
    const result = await db
      .select()
      .from(tagFollows)
      .where(and(eq(tagFollows.followerId, followerId as number), eq(tagFollows.tagId, tagId as number)))
      .limit(1);
    return result[0] ?? null;
  },

  /**
   * 新しいタグフォロー関係を作成します。
   * @param newTagFollow フォロー情報 (followerId, tagId)
   * @returns 作成された TagFollow オブジェクト
   */
  async createTagFollow(newTagFollow: NewTagFollow): Promise<TagFollow> {
    const result = await db.insert(tagFollows).values(newTagFollow).returning();
    if (result.length === 0) {
      throw new Error('Failed to create tag follow relationship or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * タグフォロー関係を削除します。
   * @param followerId ユーザーID
   * @param tagId タグID
   * @returns 削除が成功した場合は true, 失敗した場合は false
   */
  async deleteTagFollow(followerId: UserId, tagId: TagId): Promise<boolean> {
    const result = await db
      .delete(tagFollows)
      .where(and(eq(tagFollows.followerId, followerId as number), eq(tagFollows.tagId, tagId as number)))
      .returning({ deletedId: tagFollows.followerId });
    return result.length > 0;
  },

  /**
   * 指定されたユーザーがフォローしているタグの Tag オブジェクト一覧を取得します。
   * @param userId 対象ユーザーID
   * @param limit 取得件数
   * @param offset 取得開始位置
   * @returns フォローしている Tag オブジェクトの配列
   */
  async findFollowingTags(userId: UserId, limit: number = 50, offset: number = 0): Promise<Tag[]> {
    // tagFollows テーブルからフォローしている tagId を取得
    const followingTagIdsResult = await db
      .select({ tagId: tagFollows.tagId })
      .from(tagFollows)
      .where(eq(tagFollows.followerId, userId as number))
      .orderBy(desc(tagFollows.createdAt)) // 最新フォローから
      .limit(limit)
      .offset(offset);

    if (followingTagIdsResult.length === 0) {
      return [];
    }

    const followingTagIds = followingTagIdsResult.map((tf) => tf.tagId as TagId);

    // 動的インポートで tagRepository を取得し、findTagsByIds を使用
    const { tagRepository } = await import('./tag.repository');
    return tagRepository.findTagsByIds(followingTagIds);

    // TODO: tagRepository に findTagsByIds を実装し、それを使うように修正する
  },

  // TODO: 特定のタグのフォロワー数をカウントするメソッドなど、必要に応じて追加
};
