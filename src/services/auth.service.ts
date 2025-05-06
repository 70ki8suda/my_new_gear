import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { users, NewUser, User } from '../db/schema';
import { config } from '../config/env';
import { HTTPException } from 'hono/http-exception';
import { LoginInput, SignupInput } from '../validators/auth.model';
import { z } from 'zod';
import { UserIdSchema } from '../types/branded.d';
import { userRepository } from '../repositories/user.repository';

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
  const existingUserByEmail = await userRepository.findUserByEmail(input.email);
  if (existingUserByEmail) {
    throw new HTTPException(409, { message: 'このメールアドレスは既に使用されています' });
  }

  const existingUserByUsername = await userRepository.findUserByUsername(input.username);
  if (existingUserByUsername) {
    throw new HTTPException(409, { message: 'このユーザー名は既に使用されています' });
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const newUser: NewUser = {
    username: input.username,
    email: input.email,
    passwordHash: hashedPassword,
  };

  const createdUser = await userRepository.createUser(newUser);

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
  const user = await userRepository.findUserByEmail(input.email);
  if (!user) {
    throw new HTTPException(401, { message: 'メールアドレスまたはパスワードが正しくありません' });
  }

  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValidPassword) {
    throw new HTTPException(401, { message: 'メールアドレスまたはパスワードが正しくありません' });
  }

  const payload = { userId: user.id, username: user.username };
  const secret = config.JWT_SECRET;
  const expiresInValue = config.JWT_EXPIRES_IN;

  // const options: SignOptions = { expiresIn: expiresInValue as (string | number) }; // 型アサーションでも解決しない
  // @ts-expect-error expiresInValue の型が広すぎるため一時的に無視
  const options: SignOptions = { expiresIn: expiresInValue };
  const token = jwt.sign(payload, secret, options);

  return token;
};
