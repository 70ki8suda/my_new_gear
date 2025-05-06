import { z } from 'zod';

// サインアップ用スキーマ
export const signupSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'ユーザー名は3文字以上で入力してください' })
    .max(32, { message: 'ユーザー名は32文字以内で入力してください' }),
  email: z.string().email({ message: '有効なメールアドレスを入力してください' }),
  password: z.string().min(8, { message: 'パスワードは8文字以上で入力してください' }),
});

export type SignupInput = z.infer<typeof signupSchema>;

// ログイン用スキーマ
export const loginSchema = z.object({
  email: z.string().email({ message: '有効なメールアドレスを入力してください' }),
  password: z.string(), // ログイン時のパスワードエラーはサービス層で処理
});

export type LoginInput = z.infer<typeof loginSchema>;
