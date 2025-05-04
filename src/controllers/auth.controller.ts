import { Context } from 'hono';
import { signupUser, loginUser } from '../services/auth.service';
import { signupSchema, loginSchema, SignupInput, LoginInput } from '../models/auth.model';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

/**
 * サインアップ処理
 */
export const handleSignup = zValidator('json', signupSchema, (result, c: Context) => {
  if (!result.success) {
    return c.json({ error: result.error.flatten().fieldErrors }, 400);
  }

  // result.dataの型推論が効くように修正
  const signupData = result.data as SignupInput;

  return (async () => {
    const user = await signupUser(signupData);
    const { passwordHash, ...userWithoutPassword } = user;
    return c.json(userWithoutPassword, 201);
  })();
});

/**
 * ログイン処理
 */
export const handleLogin = zValidator('json', loginSchema, (result, c: Context) => {
  if (!result.success) {
    return c.json({ error: result.error.flatten().fieldErrors }, 400);
  }

  // result.dataの型推論が効くように修正
  const loginData = result.data as LoginInput;

  return (async () => {
    const token = await loginUser(loginData);
    return c.json({ token });
  })();
});
