import { userRepository } from '../repositories/user.repository';
import type { UserId } from '../types/branded.d';
import type { User } from '../db/schema';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { UserIdSchema } from '../types/branded.d'; // SafeUserSchemaのため
import { type UpdateProfileInput } from '../validators/user.validator';

// ユーザー情報の安全な形式を定義するZodスキーマ (auth.service.ts からコピー＆調整)
// パスワードハッシュは含めない
const SafeUserSchema = z.object({
  id: UserIdSchema,
  username: z.string(),
  email: z.string().email(), // email も返すように変更
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

export type SafeUser = z.infer<typeof SafeUserSchema>;

/**
 * 指定されたユーザーIDのプロフィール情報を取得します (安全な形式で)。
 * @param userId 取得するユーザーのID
 * @returns 安全なユーザー情報オブジェクト
 * @throws HTTPException(404) ユーザーが見つからない場合
 */
export const getUserProfile = async (userId: UserId): Promise<SafeUser> => {
  const user = await userRepository.findUserById(userId);

  if (!user) {
    throw new HTTPException(404, { message: 'ユーザーが見つかりませんでした' });
  }

  // DBから取得した情報を SafeUserSchema に合わせて整形
  const safeUserObject = {
    id: user.id, // DB からの ID は number だが、スキーマ側で branded type として検証
    username: user.username,
    email: user.email,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  try {
    // Zod スキーマでパースして型安全性を保証
    return SafeUserSchema.parse(safeUserObject);
  } catch (error) {
    console.error(`Failed to parse user profile for ID ${userId}:`, error);
    throw new HTTPException(500, { message: 'ユーザープロフィール取得後のデータ形式エラー' });
  }
};

/**
 * ユーザープロフィールを更新します。
 * @param userId 更新するユーザーのID (認証済みユーザーである想定)
 * @param input 更新内容 (bio?, avatarUrl?)
 * @returns 更新された安全なユーザー情報オブジェクト
 * @throws HTTPException(400) 更新データがない場合
 * @throws HTTPException(404) ユーザーが見つからない場合
 * @throws HTTPException(500) データ形式エラーの場合
 */
export const updateUserProfile = async (userId: UserId, input: UpdateProfileInput): Promise<SafeUser> => {
  // リポジトリに渡す更新データを作成
  const updates = {
    ...(input.bio !== undefined && { bio: input.bio }),
    ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
  };

  // 更新データが空でないかチェック (リポジトリ側でもチェックするが、サービス層でも行う)
  if (Object.keys(updates).length === 0) {
    throw new HTTPException(400, { message: '更新するデータが指定されていません' });
  }

  // リポジトリを呼び出して更新
  const updatedUser = await userRepository.updateUserProfile(userId, updates);

  // ユーザーが見つからなかった (または更新に失敗した) 場合
  if (!updatedUser) {
    // findUserById で再確認しても良いが、通常 update が失敗するのは ID が存在しないため
    throw new HTTPException(404, { message: 'ユーザーが見つからないか、更新に失敗しました' });
  }

  // 更新された情報を SafeUserSchema に合わせて整形
  const safeUserObject = {
    id: updatedUser.id,
    username: updatedUser.username,
    email: updatedUser.email,
    bio: updatedUser.bio,
    avatarUrl: updatedUser.avatarUrl,
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt,
  };

  try {
    // Zod スキーマでパースして型安全性を保証
    return SafeUserSchema.parse(safeUserObject);
  } catch (error) {
    console.error(`Failed to parse updated user profile for ID ${userId}:`, error);
    throw new HTTPException(500, { message: 'ユーザープロフィール更新後のデータ形式エラー' });
  }
};
