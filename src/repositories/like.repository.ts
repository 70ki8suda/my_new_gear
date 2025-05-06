import { db } from '../db';
import { likes, NewLike, Like } from '../db/schema';
import { and, eq, count } from 'drizzle-orm';
import type { UserId, PostId } from '../types/branded.d';

export const likeRepository = {
  /**
   * ユーザーが特定の投稿に既にいいねしているか確認します。
   * @param userId ユーザーID
   * @param postId 投稿ID
   * @returns いいねが存在すれば Like オブジェクト、なければ null
   */
  async findLike(userId: UserId, postId: PostId): Promise<Like | null> {
    const result = await db
      .select()
      .from(likes)
      .where(and(eq(likes.userId, userId as number), eq(likes.postId, postId as number)))
      .limit(1);
    return result[0] ?? null;
  },

  /**
   * 新しいいいねを作成します。
   * @param newLike いいね情報 (userId, postId)
   * @returns 作成された Like オブジェクト
   */
  async createLike(newLike: NewLike): Promise<Like> {
    const result = await db.insert(likes).values(newLike).returning();
    if (result.length === 0) {
      throw new Error('Failed to create like or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * いいねを削除します。
   * @param userId ユーザーID
   * @param postId 投稿ID
   * @returns 削除が成功した行数 (通常は 0 または 1)
   */
  async deleteLike(userId: UserId, postId: PostId): Promise<number> {
    const result = await db
      .delete(likes)
      .where(and(eq(likes.userId, userId as number), eq(likes.postId, postId as number)))
      .returning({ id: likes.userId });
    return result.length;
  },

  /**
   * 特定の投稿のいいね数をカウントします。
   * @param postId 投稿ID
   * @returns いいね数
   */
  async countLikesByPostId(postId: PostId): Promise<number> {
    const result = await db
      .select({ value: count() }) // count() の結果を value として取得
      .from(likes)
      .where(eq(likes.postId, postId as number));
    // 結果は [{ value: number }] の形になる
    return result[0]?.value ?? 0;
  },

  // TODO: ユーザーがいいねした投稿一覧を取得するメソッドなど、必要に応じて追加
};
