import { db } from '../db';
import { comments, NewComment, Comment } from '../db/schema';
import { eq, and, asc, desc, count } from 'drizzle-orm';
import type { UserId, PostId, CommentId } from '../types/branded.d';

export const commentRepository = {
  /**
   * 新しいコメントを作成します。
   * @param newComment 作成するコメントデータ (NewComment 型)
   * @returns 作成されたコメントオブジェクト (Comment 型)
   */
  async createComment(newComment: NewComment): Promise<Comment> {
    const result = await db.insert(comments).values(newComment).returning();
    if (result.length === 0) {
      throw new Error('Failed to create comment or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * 投稿IDに紐づくコメント一覧を取得します。
   * @param postId コメントを取得する投稿ID
   * @param limit 取得件数
   * @param offset 取得開始位置
   * @param orderBy ソート順 ('asc' または 'desc') デフォルトは 'asc'
   * @returns コメントオブジェクトの配列
   */
  async findCommentsByPostId(
    postId: PostId,
    limit: number = 50,
    offset: number = 0,
    orderBy: 'asc' | 'desc' = 'asc'
  ): Promise<Comment[]> {
    const orderFunction = orderBy === 'asc' ? asc : desc;
    const result = await db
      .select()
      .from(comments)
      .where(eq(comments.postId, postId))
      .orderBy(orderFunction(comments.createdAt)) // 作成日時順でソート
      .limit(limit)
      .offset(offset);
    return result;
  },

  /**
   * コメントIDでコメントを取得します（削除時の存在確認用など）
   * @param commentId 取得するコメントID
   * @returns コメントオブジェクト、見つからない場合は null
   */
  async findCommentById(commentId: CommentId): Promise<Comment | null> {
    const result = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    return result[0] ?? null;
  },

  /**
   * コメントを削除します。
   * @param commentId 削除するコメントID
   * @param userId 所有者確認のためのユーザーID
   * @returns 削除に成功した場合は true, コメントが見つからない/権限がない場合は false
   */
  async deleteComment(commentId: CommentId, userId: UserId): Promise<boolean> {
    // コメントが存在し、かつユーザーが所有者である場合のみ削除
    const result = await db
      .delete(comments)
      .where(and(eq(comments.id, commentId), eq(comments.authorId, userId)))
      .returning({ id: comments.id });

    return result.length > 0;
  },

  /**
   * 特定の投稿のコメント数をカウントします。
   * @param postId 投稿ID
   * @returns コメント数
   */
  async countCommentsByPostId(postId: PostId): Promise<number> {
    const result = await db
      .select({ value: count() }) // count() の結果を value として取得
      .from(comments)
      .where(eq(comments.postId, postId as number));
    // 結果は [{ value: number }] の形になる
    return result[0]?.value ?? 0;
  },
};
