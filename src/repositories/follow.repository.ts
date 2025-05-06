import { db } from '../db';
import { follows, users, NewFollow, Follow } from '../db/schema';
import { and, eq, count, desc } from 'drizzle-orm';
import type { UserId } from '../types/branded.d';
import type { User } from '../db/schema'; // User 型をインポート

export const followRepository = {
  /**
   * フォロー関係が存在するか確認します。
   * @param followerId フォローするユーザーID
   * @param followeeId フォローされるユーザーID
   * @returns フォロー関係が存在すれば Follow オブジェクト、なければ null
   */
  async findFollow(followerId: UserId, followeeId: UserId): Promise<Follow | null> {
    const result = await db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, followerId as number), eq(follows.followeeId, followeeId as number)))
      .limit(1);
    return result[0] ?? null;
  },

  /**
   * 新しいフォロー関係を作成します。
   * @param newFollow フォロー情報 (followerId, followeeId)
   * @returns 作成された Follow オブジェクト
   */
  async createFollow(newFollow: NewFollow): Promise<Follow> {
    const result = await db.insert(follows).values(newFollow).returning();
    if (result.length === 0) {
      throw new Error('Failed to create follow relationship or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * フォロー関係を削除します。
   * @param followerId フォローするユーザーID
   * @param followeeId フォローされるユーザーID
   * @returns 削除が成功した場合は true, 失敗した場合は false
   */
  async deleteFollow(followerId: UserId, followeeId: UserId): Promise<boolean> {
    const result = await db
      .delete(follows)
      .where(and(eq(follows.followerId, followerId as number), eq(follows.followeeId, followeeId as number)))
      .returning({ deletedId: follows.followerId }); // returning で削除を確認
    return result.length > 0;
  },

  /**
   * 指定されたユーザーのフォロワー数をカウントします。
   * @param userId 対象ユーザーID
   * @returns フォロワー数
   */
  async countFollowers(userId: UserId): Promise<number> {
    const result = await db
      .select({ value: count() })
      .from(follows)
      .where(eq(follows.followeeId, userId as number));
    return result[0]?.value ?? 0;
  },

  /**
   * 指定されたユーザーがフォローしているユーザー数をカウントします。
   * @param userId 対象ユーザーID
   * @returns フォロー数
   */
  async countFollowing(userId: UserId): Promise<number> {
    const result = await db
      .select({ value: count() })
      .from(follows)
      .where(eq(follows.followerId, userId as number));
    return result[0]?.value ?? 0;
  },

  /**
   * 指定されたユーザーのフォロワーの User オブジェクト一覧を取得します。
   * @param userId 対象ユーザーID
   * @param limit 取得件数
   * @param offset 取得開始位置
   * @returns フォロワーの User オブジェクトの配列
   */
  async findFollowers(userId: UserId, limit: number = 50, offset: number = 0): Promise<User[]> {
    const followerIdsResult = await db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(eq(follows.followeeId, userId as number))
      .orderBy(desc(follows.createdAt)) // 最新のフォロワーから
      .limit(limit)
      .offset(offset);

    if (followerIdsResult.length === 0) return [];

    const followerIds = followerIdsResult.map((f) => f.followerId as UserId);

    // userRepository を使ってユーザー情報を取得する (サービス層で行う方が良いかもしれないが、ここではリポジトリに含める)
    // 注意: userRepository に依存することになる
    const { userRepository } = await import('./user.repository'); // 動的インポート
    return userRepository.findUsersByIds(followerIds);
  },

  /**
   * 指定されたユーザーがフォローしているユーザーの User オブジェクト一覧を取得します。
   * @param userId 対象ユーザーID
   * @param limit 取得件数
   * @param offset 取得開始位置
   * @returns フォローしている User オブジェクトの配列
   */
  async findFollowing(userId: UserId, limit: number = 50, offset: number = 0): Promise<User[]> {
    const followeeIdsResult = await db
      .select({ followeeId: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, userId as number))
      .orderBy(desc(follows.createdAt)) // 最新フォローから
      .limit(limit)
      .offset(offset);

    if (followeeIdsResult.length === 0) return [];

    const followeeIds = followeeIdsResult.map((f) => f.followeeId as UserId);

    // userRepository を使ってユーザー情報を取得
    const { userRepository } = await import('./user.repository'); // 動的インポート
    return userRepository.findUsersByIds(followeeIds);
  },
};
