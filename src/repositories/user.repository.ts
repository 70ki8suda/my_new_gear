import { db } from '../db';
import { users, NewUser, User } from '../db/schema';
import { eq, inArray, or, like } from 'drizzle-orm';
import { UserId } from '../types/branded.d';
import bcrypt from 'bcryptjs';

// 更新用ペイロードの型 (bio, avatarUrl のみ)
type UserProfileUpdatePayload = Partial<Pick<User, 'bio' | 'avatarUrl'>>;

export const userRepository = {
  /**
   * メールアドレスでユーザーを検索します。
   * @param email 検索するメールアドレス
   * @returns ユーザーオブジェクト、見つからない場合は null
   */
  async findUserByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] ?? null;
  },

  /**
   * ユーザー名でユーザーを検索します。
   * @param username 検索するユーザー名
   * @returns ユーザーオブジェクト、見つからない場合は null
   */
  async findUserByUsername(username: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] ?? null;
  },

  /**
   * 新しいユーザーを作成します。
   * @param newUser 作成するユーザーデータ (NewUser 型)
   * @returns 作成されたユーザーオブジェクト (User 型)
   */
  async createUser(newUser: NewUser): Promise<User> {
    const result = await db.insert(users).values(newUser).returning();
    if (result.length === 0) {
      // 基本的に Drizzle v0.28+ では returning() は空配列を返さないはずだが念のため
      throw new Error('Failed to create user or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * ユーザーIDでユーザーを検索します。
   * @param id 検索するユーザーID
   * @returns ユーザーオブジェクト、見つからない場合は null
   */
  async findUserById(id: UserId): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] ?? null;
  },

  /**
   * 複数のユーザーIDでユーザー情報を一括取得します。
   * @param ids 検索するユーザーIDの配列
   * @returns ユーザーオブジェクトの配列
   */
  async findUsersByIds(ids: UserId[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }
    // UserId[] を number[] にキャスト (Drizzle が Branded Types を直接受け入れない場合)
    const numericIds = ids as number[];
    const result = await db.select().from(users).where(inArray(users.id, numericIds));
    return result;
  },

  /**
   * ユーザー名または bio に基づいてユーザーを検索します。
   * @param query 検索クエリ
   * @param limit 取得上限数 (デフォルト 20)
   * @returns ユーザーオブジェクトの配列
   */
  async searchUsersByQuery(query: string, limit: number = 20): Promise<User[]> {
    const searchTerm = `%${query}%`;
    // Drizzle の select() は Promise を返すため await は不要な場合が多い
    // v0.20.x 以降 .execute() は非推奨/不要になった
    return db
      .select()
      .from(users)
      .where(or(like(users.username, searchTerm), like(users.bio, searchTerm)))
      .limit(limit);
  },

  /**
   * ユーザープロフィールを更新します (bio, avatarUrl)。
   * @param userId 更新するユーザーのID
   * @param updates 更新データ (bio?, avatarUrl?)
   * @returns 更新されたユーザーオブジェクト (User 型)、見つからない場合は null
   */
  async updateUserProfile(userId: UserId, updates: UserProfileUpdatePayload): Promise<User | null> {
    if (Object.keys(updates).length === 0) {
      // 何も更新しない場合は現在の情報を取得して返す (null の可能性もある)
      return this.findUserById(userId);
    }

    const updateDataWithTimestamp = {
      ...updates,
      updatedAt: new Date(), // 更新日時をセット
    };

    const updatedUserArray = await db
      .update(users)
      .set(updateDataWithTimestamp)
      .where(eq(users.id, userId as number)) // Branded Type をキャスト
      .returning(); // 更新された行全体を返す

    return updatedUserArray[0] ?? null; // 更新されたユーザー情報、または見つからなかった場合は null
  },

  // TODO: Add other user-related database operations if needed (e.g., update, delete)
};
