import { HTTPException } from 'hono/http-exception';
import type { UserId, PostId } from '../types/branded.d';
import { z } from 'zod';
import { createLikeNotification } from './notification.service';
import { likeRepository } from '../repositories/like.repository';
import { postRepository } from '../repositories/post.repository';

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
  const post = await postRepository.findPostById(postId);
  if (!post) {
    throw new HTTPException(404, { message: '投稿が見つかりませんでした' });
  }

  // 既にいいねしているか確認
  const existingLike = await likeRepository.findLike(userId, postId);
  if (existingLike) {
    // 既にいいね済みの場合、そのままいいね数を返す
    const likesCount = await likeRepository.countLikesByPostId(postId);
    const resultObject = { success: true, likesCount: likesCount, message: '既にいいねしています' };
    try {
      return LikeActionResultSchema.parse(resultObject);
    } catch (error) {
      console.error('Failed to parse like result:', error);
      throw new HTTPException(500, { message: 'いいね後のデータ形式エラー' });
    }
  }

  // いいねをデータベースに挿入
  const newLikeData = {
    userId: userId,
    postId: postId,
    // createdAt はリポジトリ層またはDBデフォルトで設定される想定
  };
  await likeRepository.createLike(newLikeData);

  // 通知を作成（非同期で実行し、エラーが発生しても処理を続行）
  // 投稿者自身のいいねでは通知しない
  if (post.authorId !== userId) {
    try {
      // post.authorId が UserId 型であることを確認 (必要ならキャスト)
      const authorIdAsUserId = post.authorId as UserId;
      await createLikeNotification(authorIdAsUserId, userId, postId);
    } catch (error) {
      // 通知作成のエラーはログに記録するだけで、いいね処理自体は成功とする
      console.error('いいね通知作成中にエラーが発生しました:', error);
    }
  }

  // 更新後のいいね数を取得して返す
  const likesCount = await likeRepository.countLikesByPostId(postId);
  const resultObject = { success: true, likesCount: likesCount };
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
  // 投稿が存在するか確認 (unlikeの場合、投稿がなくてもエラーではないかもしれないが、一貫性のためチェック)
  const postExists = await postRepository.findPostById(postId);
  if (!postExists) {
    throw new HTTPException(404, { message: '投稿が見つかりませんでした' });
  }

  // いいねをデータベースから削除 (存在しなくてもエラーにはしない)
  await likeRepository.deleteLike(userId, postId);

  // 更新後のいいね数を取得して返す (削除されたかどうかにかかわらず現在の数を返す)
  const likesCount = await likeRepository.countLikesByPostId(postId);
  // deleteLike が成功したかどうかのメッセージは含めず、単純に現在の数を返す
  const resultObject = { success: true, likesCount: likesCount };
  try {
    return LikeActionResultSchema.parse(resultObject);
  } catch (error) {
    console.error('Failed to parse unlike result:', error);
    throw new HTTPException(500, { message: 'いいね解除後のデータ形式エラー' });
  }
};
