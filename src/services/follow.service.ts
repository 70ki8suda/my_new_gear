import { db } from '../db';
import { follows, users, tags, tagFollows, type NewFollow, type NewTagFollow } from '../db/schema';
import { HTTPException } from 'hono/http-exception';
import { and, eq, count, desc } from 'drizzle-orm';
import type { UserId, TagId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, TagIdSchema } from '../types/branded.d';
import { followRepository } from '../repositories/follow.repository';
import { tagFollowRepository } from '../repositories/tagFollow.repository';
import { userRepository } from '../repositories/user.repository';
import { tagRepository } from '../repositories/tag.repository';
import type { Tag } from '../db/schema';

// フォロー/アンフォロー結果のスキーマ
const FollowActionResultSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  // followersCount: z.number().int().min(0).optional(), // 必要なら追加
  // followingCount: z.number().int().min(0).optional(), // 必要なら追加
});

// フォロー数/フォロワー数の戻り値スキーマ
const FollowCountsSchema = z.object({
  followersCount: z.number().int().min(0),
  followingCount: z.number().int().min(0),
});

// ユーザー基本情報のスキーマ
const UserInfoSchema = z.object({
  id: UserIdSchema,
  username: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
});

// ユーザーリストの戻り値スキーマ
const UserListSchema = z.array(UserInfoSchema);

// タグ情報のスキーマ (ここに移動)
const TagInfoSchema = z.object({
  id: TagIdSchema,
  name: z.string(),
});

// フォロー中タグリストの戻り値スキーマ
const FollowingTagsSchema = z.array(TagInfoSchema);

/**
 * 指定されたユーザーをフォローします。
 * @param followerId フォローするユーザーのID
 * @param followeeId フォローされるユーザーのID
 * @returns フォロー操作の結果
 */
export const followUser = async (followerId: UserId, followeeId: UserId) => {
  if (followerId === followeeId) {
    throw new HTTPException(400, { message: '自分自身をフォローすることはできません' });
  }

  const followeeExists = await userRepository.findUserById(followeeId);
  if (!followeeExists) {
    throw new HTTPException(404, { message: 'フォロー対象のユーザーが見つかりません' });
  }

  const existingFollow = await followRepository.findFollow(followerId, followeeId);
  if (existingFollow) {
    const resultObject = { success: true, message: '既にフォローしています' };
    try {
      return FollowActionResultSchema.parse(resultObject);
    } catch (error) {
      console.error('Failed to parse existing follow result:', error);
      throw new HTTPException(500, { message: 'フォロー状況確認後のデータ形式エラー' });
    }
  }

  const newFollowData = {
    followerId: followerId,
    followeeId: followeeId,
  };

  try {
    await followRepository.createFollow(newFollowData);
  } catch (error) {
    console.error('Error creating follow relationship:', error);
    throw new HTTPException(500, { message: 'フォロー処理中にエラーが発生しました' });
  }

  const resultObject = { success: true };
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
  if (followerId === followeeId) {
    throw new HTTPException(400, { message: '自分自身のフォローは解除できません' });
  }

  const deleted = await followRepository.deleteFollow(followerId, followeeId);

  const resultObject = { success: true };
  try {
    return FollowActionResultSchema.parse(resultObject);
  } catch (error) {
    console.error('Failed to parse unfollow result:', error);
    throw new HTTPException(500, { message: 'フォロー解除後のデータ形式エラー' });
  }
};

/**
 * ユーザーのフォロワー数とフォロー数を取得します
 * @param userId 対象ユーザーのID
 * @returns フォロワー数とフォロー数
 */
export const getUserFollowCounts = async (userId: UserId) => {
  try {
    const userExists = await userRepository.findUserById(userId);
    if (!userExists) {
      throw new HTTPException(404, { message: '指定されたユーザーが見つかりません' });
    }

    const followersCount = await followRepository.countFollowers(userId);
    const followingCount = await followRepository.countFollowing(userId);

    const countObject = {
      followersCount: followersCount,
      followingCount: followingCount,
    };

    try {
      return FollowCountsSchema.parse(countObject);
    } catch (error) {
      console.error('Failed to parse follow counts:', error);
      throw new HTTPException(500, { message: 'フォロー数カウント結果のパースに失敗しました' });
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('Error getting follow counts:', error);
    throw new HTTPException(500, { message: 'フォロー数カウント中にエラーが発生しました' });
  }
};

/**
 * 指定されたユーザーのフォロワー一覧を取得します
 * @param userId 対象ユーザーのID
 * @returns フォロワーのユーザー情報リスト
 */
export const getFollowers = async (userId: UserId, limit: number = 50, offset: number = 0) => {
  try {
    const userExists = await userRepository.findUserById(userId);
    if (!userExists) {
      throw new HTTPException(404, { message: '指定されたユーザーが見つかりません' });
    }

    const followersData = await followRepository.findFollowers(userId, limit, offset);

    const followersList = followersData.map((user) => ({
      id: user.id as UserId,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    }));

    try {
      return UserListSchema.parse(followersList);
    } catch (error) {
      console.error('Failed to parse followers list:', error);
      throw new HTTPException(500, { message: 'フォロワーリスト形式のパースに失敗しました' });
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('Error getting followers:', error);
    throw new HTTPException(500, { message: 'フォロワー一覧の取得中にエラーが発生しました' });
  }
};

/**
 * 指定されたユーザーがフォローしているユーザー一覧を取得します
 * @param userId 対象ユーザーのID
 * @returns フォローしているユーザー情報リスト
 */
export const getFollowing = async (userId: UserId, limit: number = 50, offset: number = 0) => {
  try {
    const userExists = await userRepository.findUserById(userId);
    if (!userExists) {
      throw new HTTPException(404, { message: '指定されたユーザーが見つかりません' });
    }

    const followingData = await followRepository.findFollowing(userId, limit, offset);

    const followingList = followingData.map((user) => ({
      id: user.id as UserId,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    }));

    try {
      return UserListSchema.parse(followingList);
    } catch (error) {
      console.error('Failed to parse following list:', error);
      throw new HTTPException(500, { message: 'フォロー中リスト形式のパースに失敗しました' });
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('Error getting following:', error);
    throw new HTTPException(500, { message: 'フォロー中一覧の取得中にエラーが発生しました' });
  }
};

/**
 * 指定されたタグをフォローします。
 * @param followerId フォローするユーザーのID
 * @param tagId フォローされるタグのID
 * @returns フォロー操作の結果
 */
export const followTag = async (followerId: UserId, tagId: TagId) => {
  // タグが存在するか確認
  // const tagExists = await db
  //   .select({ id: tags.id })
  //   .from(tags)
  //   .where(eq(tags.id, tagId as number))
  //   .limit(1);
  // if (tagExists.length === 0) {
  //   throw new HTTPException(404, { message: 'フォロー対象のタグが見つかりません' });
  // }
  const tagExists = await tagRepository.findTagById(tagId);
  if (!tagExists) {
    throw new HTTPException(404, { message: 'フォロー対象のタグが見つかりません' });
  }

  // 既にフォローしているか確認
  // const existingFollow = await db
  //   .select()
  //   .from(tagFollows)
  //   .where(and(eq(tagFollows.followerId, followerId as number), eq(tagFollows.tagId, tagId as number)))
  //   .limit(1);
  // if (existingFollow.length > 0) {
  //   const resultObject = { success: true, message: '既にこのタグをフォローしています' };
  //   try {
  //     return FollowActionResultSchema.parse(resultObject);
  //   } catch (error) {
  //     console.error('Failed to parse existing tag follow result:', error);
  //     throw new HTTPException(500, { message: 'タグフォロー状況確認後のデータ形式エラー' });
  //   }
  const existingFollow = await tagFollowRepository.findTagFollow(followerId, tagId);
  if (existingFollow) {
    const resultObject = { success: true, message: '既にフォローしています' };
    try {
      return FollowActionResultSchema.parse(resultObject);
    } catch (error) {
      console.error('Failed to parse existing tag follow result:', error);
      throw new HTTPException(500, { message: 'タグフォロー状況確認後のデータ形式エラー' });
    }
  }

  // フォロー関係を作成
  // const newTagFollow: NewTagFollow = {
  //   followerId: followerId as number,
  //   tagId: tagId as number,
  //   createdAt: new Date(),
  // };
  const newTagFollowData = {
    followerId: followerId,
    tagId: tagId,
    // createdAt は DB デフォルトかリポジトリで設定
  };
  try {
    // await db.insert(tagFollows).values(newTagFollow);
    await tagFollowRepository.createTagFollow(newTagFollowData);
  } catch (error) {
    console.error('Error creating tag follow relationship:', error);
    throw new HTTPException(500, { message: 'タグフォロー処理中にエラーが発生しました' });
  }

  // TODO: タグフォロー通知？ (仕様による)

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
  // タグが存在するか一応確認 (必須ではないかも)
  // const tagExists = await tagRepository.findTagById(tagId);
  // if (!tagExists) {
  //   throw new HTTPException(404, { message: 'フォロー解除対象のタグが見つかりません' });
  // }

  // フォロー関係を削除 (存在しなくてもエラーにしない)
  // const deleteResult = await db
  //   .delete(tagFollows)
  //   .where(and(eq(tagFollows.followerId, followerId as number), eq(tagFollows.tagId, tagId as number)))
  //   .returning({ deletedId: tagFollows.followerId });
  // if (deleteResult.length === 0) {
  //   const resultObject = { success: true, message: 'このタグはフォローされていません' };
  //   try {
  //     return FollowActionResultSchema.parse(resultObject);
  //   } catch (error) {
  //     console.error('Failed to parse not following tag result:', error);
  //     throw new HTTPException(500, { message: 'タグフォロー解除状況確認後のデータ形式エラー' });
  //   }
  // }
  await tagFollowRepository.deleteTagFollow(followerId, tagId);

  const resultObject = { success: true };
  try {
    return FollowActionResultSchema.parse(resultObject);
  } catch (error) {
    console.error('Failed to parse tag unfollow result:', error);
    throw new HTTPException(500, { message: 'タグフォロー解除後のデータ形式エラー' });
  }
};

/**
 * 指定されたユーザーがフォローしているタグ一覧を取得します
 * @param userId 対象ユーザーのID
 * @param limit 取得件数
 * @param offset 取得開始位置
 * @returns フォローしているタグの情報リスト
 */
export const getFollowingTags = async (userId: UserId, limit: number = 50, offset: number = 0) => {
  // ユーザーが存在するか確認
  // const userExists = await db
  //   .select({ id: users.id })
  //   .from(users)
  //   .where(eq(users.id, userId as number))
  //   .limit(1);
  // if (userExists.length === 0) {
  //   throw new HTTPException(404, { message: '指定されたユーザーが見つかりません' });
  // }
  const userExists = await userRepository.findUserById(userId);
  if (!userExists) {
    throw new HTTPException(404, { message: '指定されたユーザーが見つかりません' });
  }

  // フォロー中のタグ一覧を取得
  // const followingTagsResult = await db
  //   .select({
  //     id: tags.id,
  //     name: tags.name,
  //     createdAt: tagFollows.createdAt, // フォロー日時
  //   })
  //   .from(tagFollows)
  //   .innerJoin(tags, eq(tagFollows.tagId, tags.id))
  //   .where(eq(tagFollows.followerId, userId as number))
  //   .orderBy(desc(tagFollows.createdAt)); // 最新のフォローから順に
  // リポジトリからフォローしている Tag オブジェクトリストを取得
  // 注意: tagFollowRepository.findFollowingTags は一時的に直接 DB を見ている状態
  const followingTagsData = await tagFollowRepository.findFollowingTags(userId, limit, offset);

  // 結果を整形
  // const followingTagsList = followingTagsResult.map((tag) => ({
  //   id: tag.id as TagId,
  //   name: tag.name,
  //   createdAt: tag.createdAt,
  // }));
  // Tag オブジェクトを TagInfoSchema に合わせて整形
  const followingTagsList = followingTagsData.map((tag) => ({
    id: tag.id as TagId,
    name: tag.name,
    // createdAt は TagInfoSchema には含めない
  }));

  // タグリストの戻り値スキーマを使用
  // const TagListSchema = z.array(
  //   z.object({
  //     id: TagIdSchema,
  //     name: z.string(),
  //     createdAt: z.date(),
  //   })
  // );
  // Note: FollowingTagsSchema はファイル上部で定義済みのはず

  try {
    // return TagListSchema.parse(followingTagsList);
    // return FollowingTagsSchema.parse(followingTagsList);
    // FollowingTagsSchema ではなく z.array(TagInfoSchema) でパース
    // ここでの参照は OK になるはず
    return z.array(TagInfoSchema).parse(followingTagsList);
  } catch (error) {
    console.error('Failed to parse following tags list:', error);
    throw new HTTPException(500, { message: 'フォロー中タグリスト形式のパースに失敗しました' });
  }
};
