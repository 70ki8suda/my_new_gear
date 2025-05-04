import { db } from '../db';
import { likes, posts, type NewLike } from '../db/schema';
import { HTTPException } from 'hono/http-exception';
import { and, eq, count } from 'drizzle-orm';

/**
 * 指定された投稿にいいねを追加します
 * @param userId いいねするユーザーID
 * @param postId いいねされる投稿ID
 * @returns いいね操作の結果と現在のいいね数
 */
export const likePost = async (userId: number, postId: number) => {
  // 投稿が存在するか確認
  const postExists = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (postExists.length === 0) {
    throw new HTTPException(404, { message: '投稿が見つかりませんでした' });
  }

  // 既にいいねしているか確認
  const existingLike = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.postId, postId)))
    .limit(1);
  if (existingLike.length > 0) {
    // 既にいいね済みの場合、そのままいいね数を返す
    const likesCountResult = await db.select({ count: count() }).from(likes).where(eq(likes.postId, postId));
    return { success: true, likesCount: likesCountResult[0].count, message: '既にいいねしています' };
  }

  // いいねをデータベースに挿入
  const newLike: NewLike = {
    userId,
    postId,
    createdAt: new Date(),
  };
  await db.insert(likes).values(newLike);

  // 更新後のいいね数を取得して返す
  const likesCountResult = await db.select({ count: count() }).from(likes).where(eq(likes.postId, postId));
  return { success: true, likesCount: likesCountResult[0].count };
};

/**
 * 指定された投稿からいいねを削除します
 * @param userId いいねを解除するユーザーID
 * @param postId いいねを解除される投稿ID
 * @returns いいね解除操作の結果と現在のいいね数
 */
export const unlikePost = async (userId: number, postId: number) => {
  // 投稿が存在するか確認 (unlikeの場合は必須ではないかもしれないが念のため)
  const postExists = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (postExists.length === 0) {
    throw new HTTPException(404, { message: '投稿が見つかりませんでした' });
  }

  // いいねが存在するか確認
  const existingLike = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.postId, postId)))
    .limit(1);
  if (existingLike.length === 0) {
    // いいねが存在しない場合、そのままいいね数を返す
    const likesCountResult = await db.select({ count: count() }).from(likes).where(eq(likes.postId, postId));
    return { success: true, likesCount: likesCountResult[0].count, message: 'いいねされていません' };
  }

  // いいねをデータベースから削除
  await db.delete(likes).where(and(eq(likes.userId, userId), eq(likes.postId, postId)));

  // 更新後のいいね数を取得して返す
  const likesCountResult = await db.select({ count: count() }).from(likes).where(eq(likes.postId, postId));
  return { success: true, likesCount: likesCountResult[0].count };
};
