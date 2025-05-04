import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { db } from '../db';
import { users, NewUser } from '../db/schema';
import { config } from '../config/env';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { LoginInput, SignupInput } from '../models/auth.model';
import { z } from 'zod';
import { UserIdSchema } from '../types/branded.d';

// signupUser の戻り値スキーマ (パスワードハッシュを含まない)
const SafeUserSchema = z.object({
  id: UserIdSchema,
  username: z.string(),
  email: z.string().email(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

/**
 * 新規ユーザーを登録します。
 * @param input サインアップ情報
 * @returns 作成されたユーザー情報 (安全な形式)
 */
export const signupUser = async (input: SignupInput) => {
  const existingUserByEmail = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existingUserByEmail.length > 0) {
    throw new HTTPException(409, { message: 'このメールアドレスは既に使用されています' });
  }

  const existingUserByUsername = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
  if (existingUserByUsername.length > 0) {
    throw new HTTPException(409, { message: 'このユーザー名は既に使用されています' });
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const newUser: NewUser = {
    username: input.username,
    email: input.email,
    passwordHash: hashedPassword,
  };

  const createdUserArray = await db.insert(users).values(newUser).returning();
  const createdUser = createdUserArray[0];

  // 戻り値オブジェクトを作成 (パスワードハッシュを除外)
  const safeUserObject = {
    id: createdUser.id, // DB からの ID は number
    username: createdUser.username,
    email: createdUser.email,
    bio: createdUser.bio,
    avatarUrl: createdUser.avatarUrl,
    createdAt: createdUser.createdAt,
    updatedAt: createdUser.updatedAt,
  };

  // 戻り値をスキーマで parse する
  try {
    return SafeUserSchema.parse(safeUserObject);
  } catch (error) {
    console.error('Failed to parse created user:', error);
    throw new HTTPException(500, { message: 'ユーザー登録後のデータ形式エラー' });
  }
};

/**
 * ユーザーをログインさせ、JWTを生成します。
 * @param input ログイン情報
 * @returns JWTトークン (文字列)
 */
export const loginUser = async (input: LoginInput) => {
  const user = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (user.length === 0) {
    throw new HTTPException(401, { message: 'メールアドレスまたはパスワードが正しくありません' });
  }

  const isValidPassword = await bcrypt.compare(input.password, user[0].passwordHash);
  if (!isValidPassword) {
    throw new HTTPException(401, { message: 'メールアドレスまたはパスワードが正しくありません' });
  }

  const payload = { userId: user[0].id, username: user[0].username };
  const secret = config.JWT_SECRET;
  let expiresInValue: string | number = config.JWT_EXPIRES_IN;
  if (typeof expiresInValue === 'string' && /\d+d$/.test(expiresInValue)) {
    expiresInValue = parseInt(expiresInValue) * 24 * 60 * 60; // 日数を秒数に
  } else if (typeof expiresInValue === 'string') {
    expiresInValue = parseInt(expiresInValue) || 3600; // デフォルト1時間など
  }

  const options: SignOptions = { expiresIn: expiresInValue };
  const token = jwt.sign(payload, secret, options);

  return token;
};
