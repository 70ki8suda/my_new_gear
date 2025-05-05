import { db } from '../db';
import { likes, posts, type NewLike } from '../db/schema';
import { HTTPException } from 'hono/http-exception';
import { and, eq, count } from 'drizzle-orm';
import type { UserId, PostId } from '../types/branded.d';
import { z } from 'zod';
import { createLikeNotification } from './notification.service';

// like/unlike の戻り値スキーマ
const LikeActionResultSchema = z.object({
  success: z.literal(true),
  likesCount: z.number().int().min(0),
  message: z.string().optional(),
});

/**
 * 指定された投稿にいいねを追加します
 * @param userId いいねするユーザーID
 * @param postId いいねされる投稿ID
 * @returns いいね操作の結果と現在のいいね数
 */
export const likePost = async (userId: UserId, postId: PostId) => {
  // 投稿が存在するか確認
  const postData = await db
    .select({ id: posts.id, authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId as number))
    .limit(1);
  if (postData.length === 0) {
    throw new HTTPException(404, { message: '投稿が見つかりませんでした' });
  }

  const post = postData[0];

  // 既にいいねしているか確認
  const existingLike = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId as number), eq(likes.postId, postId as number)))
    .limit(1);
  if (existingLike.length > 0) {
    // 既にいいね済みの場合、そのままいいね数を返す
    const likesCountResult = await db
      .select({ count: count() })
      .from(likes)
      .where(eq(likes.postId, postId as number));
    const resultObject = { success: true, likesCount: likesCountResult[0].count, message: '既にいいねしています' };
    try {
      return LikeActionResultSchema.parse(resultObject);
    } catch (error) {
      console.error('Failed to parse like result:', error);
      throw new HTTPException(500, { message: 'いいね後のデータ形式エラー' });
    }
  }

  // いいねをデータベースに挿入
  const newLike: NewLike = {
    userId: userId as number,
    postId: postId as number,
    createdAt: new Date(),
  };
  await db.insert(likes).values(newLike);

  // 通知を作成（非同期で実行し、エラーが発生しても処理を続行）
  try {
    await createLikeNotification(post.authorId as UserId, userId, postId);
  } catch (error) {
    // 通知作成のエラーはログに記録するだけで、いいね処理自体は成功とする
    console.error('いいね通知作成中にエラーが発生しました:', error);
  }

  // 更新後のいいね数を取得して返す
  const likesCountResult = await db
    .select({ count: count() })
    .from(likes)
    .where(eq(likes.postId, postId as number));
  const resultObject = { success: true, likesCount: likesCountResult[0].count };
  try {
    return LikeActionResultSchema.parse(resultObject);
  } catch (error) {
    console.error('Failed to parse like result:', error);
    throw new HTTPException(500, { message: 'いいね後のデータ形式エラー' });
  }
};

/**
 * 指定された投稿からいいねを削除します
 * @param userId いいねを解除するユーザーID
 * @param postId いいねを解除される投稿ID
 * @returns いいね解除操作の結果と現在のいいね数
 */
export const unlikePost = async (userId: UserId, postId: PostId) => {
  // 投稿が存在するか確認 (unlikeの場合は必須ではないかもしれないが念のため)
  const postExists = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, postId as number))
    .limit(1);
  if (postExists.length === 0) {
    throw new HTTPException(404, { message: '投稿が見つかりませんでした' });
  }

  // いいねが存在するか確認
  const existingLike = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId as number), eq(likes.postId, postId as number)))
    .limit(1);
  if (existingLike.length === 0) {
    // いいねが存在しない場合、そのままいいね数を返す
    const likesCountResult = await db
      .select({ count: count() })
      .from(likes)
      .where(eq(likes.postId, postId as number));
    const resultObject = { success: true, likesCount: likesCountResult[0].count, message: 'いいねされていません' };
    try {
      return LikeActionResultSchema.parse(resultObject);
    } catch (error) {
      console.error('Failed to parse unlike result:', error);
      throw new HTTPException(500, { message: 'いいね解除後のデータ形式エラー' });
    }
  }

  // いいねをデータベースから削除
  await db.delete(likes).where(and(eq(likes.userId, userId as number), eq(likes.postId, postId as number)));

  // 更新後のいいね数を取得して返す
  const likesCountResult = await db
    .select({ count: count() })
    .from(likes)
    .where(eq(likes.postId, postId as number));
  const resultObject = { success: true, likesCount: likesCountResult[0].count };
  try {
    return LikeActionResultSchema.parse(resultObject);
  } catch (error) {
    console.error('Failed to parse unlike result:', error);
    throw new HTTPException(500, { message: 'いいね解除後のデータ形式エラー' });
  }
};
