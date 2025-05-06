import { db } from '../db';
import { posts, NewPost, Post } from '../db/schema';
import { eq, desc, asc, and } from 'drizzle-orm';
import type { ItemId, PostId, UserId } from '../types/branded.d';

export const postRepository = {
  /**
   * 新しい投稿を作成します。
   * @param newPost 作成する投稿データ (NewPost 型)
   * @returns 作成された投稿オブジェクト (Post 型)
   */
  async createPost(newPost: NewPost): Promise<Post> {
    const result = await db.insert(posts).values(newPost).returning();
    if (result.length === 0) {
      throw new Error('Failed to create post or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * 投稿IDで投稿を検索します。
   * @param postId 検索する投稿ID
   * @returns 投稿オブジェクト、見つからない場合は null
   */
  async findPostById(postId: PostId): Promise<Post | null> {
    const result = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    return result[0] ?? null;
  },

  /**
   * アイテムIDに紐づく投稿一覧を取得します。
   * @param itemId 投稿を取得するアイテムID
   * @param limit 取得件数
   * @param offset 取得開始位置
   * @param orderBy ソート順 ('asc' または 'desc') デフォルトは 'desc' (新しい順)
   * @returns 投稿オブジェクトの配列
   */
  async findPostsByItemId(
    itemId: ItemId,
    limit: number = 50,
    offset: number = 0,
    orderBy: 'asc' | 'desc' = 'desc'
  ): Promise<Post[]> {
    const orderFunction = orderBy === 'desc' ? desc : asc;
    const result = await db
      .select()
      .from(posts)
      .where(eq(posts.itemId, itemId))
      .orderBy(orderFunction(posts.createdAt)) // 作成日時順でソート
      .limit(limit)
      .offset(offset);
    return result;
  },

  /**
   * 投稿を削除します (投稿者のみ可能)。
   * @param postId 削除する投稿ID
   * @param authorId 所有者確認のためのユーザーID
   * @returns 削除に成功した場合は true, 見つからない/権限がない場合は false
   */
  async deletePost(postId: PostId, authorId: UserId): Promise<boolean> {
    const result = await db
      .delete(posts)
      .where(and(eq(posts.id, postId), eq(posts.authorId, authorId))) // `and` を使うためにインポートが必要
      .returning({ id: posts.id });
    return result.length > 0;
  },

  // TODO: Update post?
  // TODO: Find posts by user ID?
  // TODO: Get posts for feed (complex query)? - Might belong in service layer or dedicated feed repository
};
