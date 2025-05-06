import { db } from '../db';
import { users, NewUser, User } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { UserId } from '../types/branded.d';

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

  // TODO: Add other user-related database operations if needed (e.g., update, delete)
};
