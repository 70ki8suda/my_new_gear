import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { db } from '../db';
import { users, NewUser } from '../db/schema';
import { config } from '../config/env';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { LoginInput, SignupInput } from '../models/auth.model';

/**
 * 新規ユーザーを登録します。
 * @param input サインアップ情報
 * @returns 作成されたユーザー情報
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

  const createdUser = await db.insert(users).values(newUser).returning();
  return createdUser[0];
};

/**
 * ユーザーをログインさせ、JWTを生成します。
 * @param input ログイン情報
 * @returns JWTトークン
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
  const expiresInSeconds = parseInt(config.JWT_EXPIRES_IN) * 24 * 60 * 60; // Convert days to seconds
  const options: SignOptions = { expiresIn: expiresInSeconds };

  const token = jwt.sign(payload, secret, options);

  return token;
};
