import { db } from '../db';
import { users, NewUser, User } from '../db/schema';
import { eq } from 'drizzle-orm';

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
  // TODO: Add other user-related database operations if needed (e.g., findById, update, delete)
};
