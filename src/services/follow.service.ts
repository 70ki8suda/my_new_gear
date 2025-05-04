import { db } from '../db';
import { follows, users, tags, tagFollows, type NewFollow, type NewTagFollow } from '../db/schema';
import { HTTPException } from 'hono/http-exception';
import { and, eq, count } from 'drizzle-orm';
import type { UserId, TagId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, TagIdSchema } from '../types/branded.d';

// フォロー/アンフォロー結果のスキーマ
const FollowActionResultSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  // followersCount: z.number().int().min(0).optional(), // 必要なら追加
  // followingCount: z.number().int().min(0).optional(), // 必要なら追加
});

/**
 * 指定されたユーザーをフォローします。
 * @param followerId フォローするユーザーのID
 * @param followeeId フォローされるユーザーのID
 * @returns フォロー操作の結果
 */
export const followUser = async (followerId: UserId, followeeId: UserId) => {
  // 自分自身をフォローしようとしていないかチェック
  if (followerId === followeeId) {
    throw new HTTPException(400, { message: '自分自身をフォローすることはできません' });
  }

  // フォローされるユーザーが存在するか確認
  const followeeExists = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, followeeId as number))
    .limit(1);
  if (followeeExists.length === 0) {
    throw new HTTPException(404, { message: 'フォロー対象のユーザーが見つかりません' });
  }

  // 既にフォローしているか確認
  const existingFollow = await db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, followerId as number), eq(follows.followeeId, followeeId as number)))
    .limit(1);

  if (existingFollow.length > 0) {
    const resultObject = { success: true, message: '既にフォローしています' };
    try {
      // omit 不要、スキーマに message は optional で含まれる
      return FollowActionResultSchema.parse(resultObject);
    } catch (error) {
      console.error('Failed to parse existing follow result:', error);
      throw new HTTPException(500, { message: 'フォロー状況確認後のデータ形式エラー' });
    }
  }

  // フォロー関係を作成
  const newFollow: NewFollow = {
    followerId: followerId as number,
    followeeId: followeeId as number,
    createdAt: new Date(),
  };

  try {
    await db.insert(follows).values(newFollow);
  } catch (error) {
    // ユニークキー制約違反など、DBエラーの可能性
    console.error('Error creating follow relationship:', error);
    // すでに存在するケースは上でハンドルしているので、ここでは一般的なエラーとする
    throw new HTTPException(500, { message: 'フォロー処理中にエラーが発生しました' });
  }

  const resultObject = { success: true }; // message なしで返す
  try {
    return FollowActionResultSchema.parse(resultObject);
  } catch (error) {
    console.error('Failed to parse follow result:', error);
    throw new HTTPException(500, { message: 'フォロー後のデータ形式エラー' });
  }
};

/**
 * 指定されたユーザーのフォローを解除します。
 * @param followerId フォローを解除するユーザーのID
 * @param followeeId フォローを解除されるユーザーのID
 * @returns フォロー解除操作の結果
 */
export const unfollowUser = async (followerId: UserId, followeeId: UserId) => {
  // 自分自身のフォロー解除は意味がないのでチェック
  if (followerId === followeeId) {
    throw new HTTPException(400, { message: '自分自身のフォローは解除できません' });
  }

  // フォロー関係が存在するか確認 (存在しなければ何もしないか、エラーを返すか)
  const deleteResult = await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId as number), eq(follows.followeeId, followeeId as number)))
    .returning({ deletedId: follows.followerId }); // 削除されたか確認するために何か返す

  if (deleteResult.length === 0) {
    const resultObject = { success: true, message: 'フォローされていません' };
    try {
      // omit 不要
      return FollowActionResultSchema.parse(resultObject);
    } catch (error) {
      console.error('Failed to parse not following result:', error);
      throw new HTTPException(500, { message: 'フォロー解除状況確認後のデータ形式エラー' });
    }
  }

  const resultObject = { success: true }; // message なしで返す
  try {
    return FollowActionResultSchema.parse(resultObject);
  } catch (error) {
    console.error('Failed to parse unfollow result:', error);
    throw new HTTPException(500, { message: 'フォロー解除後のデータ形式エラー' });
  }
};

// TODO: フォロワー数/フォロー数を取得する関数を追加
// export const getUserFollowCounts = async (userId: UserId) => { ... }

// TODO: フォロワー/フォロー一覧を取得する関数を追加
// export const getFollowers = async (userId: UserId) => { ... }
// export const getFollowing = async (userId: UserId) => { ... }

/**
 * 指定されたタグをフォローします。
 * @param followerId フォローするユーザーのID
 * @param tagId フォローされるタグのID
 * @returns フォロー操作の結果
 */
export const followTag = async (followerId: UserId, tagId: TagId) => {
  // タグが存在するか確認
  const tagExists = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.id, tagId as number))
    .limit(1);
  if (tagExists.length === 0) {
    throw new HTTPException(404, { message: 'フォロー対象のタグが見つかりません' });
  }

  // 既にフォローしているか確認
  const existingFollow = await db
    .select()
    .from(tagFollows)
    .where(and(eq(tagFollows.followerId, followerId as number), eq(tagFollows.tagId, tagId as number)))
    .limit(1);

  if (existingFollow.length > 0) {
    const resultObject = { success: true, message: '既にこのタグをフォローしています' };
    try {
      return FollowActionResultSchema.parse(resultObject);
    } catch (error) {
      console.error('Failed to parse existing tag follow result:', error);
      throw new HTTPException(500, { message: 'タグフォロー状況確認後のデータ形式エラー' });
    }
  }

  // フォロー関係を作成
  const newTagFollow: NewTagFollow = {
    followerId: followerId as number,
    tagId: tagId as number,
    createdAt: new Date(),
  };

  try {
    await db.insert(tagFollows).values(newTagFollow);
  } catch (error) {
    console.error('Error creating tag follow relationship:', error);
    throw new HTTPException(500, { message: 'タグフォロー処理中にエラーが発生しました' });
  }

  const resultObject = { success: true };
  try {
    return FollowActionResultSchema.parse(resultObject);
  } catch (error) {
    console.error('Failed to parse tag follow result:', error);
    throw new HTTPException(500, { message: 'タグフォロー後のデータ形式エラー' });
  }
};

/**
 * 指定されたタグのフォローを解除します。
 * @param followerId フォローを解除するユーザーのID
 * @param tagId フォローを解除されるタグのID
 * @returns フォロー解除操作の結果
 */
export const unfollowTag = async (followerId: UserId, tagId: TagId) => {
  const deleteResult = await db
    .delete(tagFollows)
    .where(and(eq(tagFollows.followerId, followerId as number), eq(tagFollows.tagId, tagId as number)))
    .returning({ deletedId: tagFollows.followerId });

  if (deleteResult.length === 0) {
    const resultObject = { success: true, message: 'このタグはフォローされていません' };
    try {
      return FollowActionResultSchema.parse(resultObject);
    } catch (error) {
      console.error('Failed to parse not following tag result:', error);
      throw new HTTPException(500, { message: 'タグフォロー解除状況確認後のデータ形式エラー' });
    }
  }

  const resultObject = { success: true };
  try {
    return FollowActionResultSchema.parse(resultObject);
  } catch (error) {
    console.error('Failed to parse tag unfollow result:', error);
    throw new HTTPException(500, { message: 'タグフォロー解除後のデータ形式エラー' });
  }
};

// TODO: ユーザーがフォローしているタグ一覧を取得する関数
// export const getFollowingTags = async (userId: UserId) => { ... }
