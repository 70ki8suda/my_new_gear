import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

/**
 * JWTトークンの型定義
 */
export interface JwtPayload {
  userId: number;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * 認証ミドルウェア
 *
 * リクエストヘッダーからJWTトークンを取得し、検証します。
 * 検証が成功した場合、ユーザー情報をコンテキストに追加します。
 */
export const authMiddleware = async (c: Context, next: Next) => {
  try {
    // Authorizationヘッダーからトークンを取得
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: '認証が必要です' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new HTTPException(401, { message: '無効なトークンです' });
    }

    // トークンを検証
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

      // ユーザー情報をコンテキストに追加
      c.set('user', {
        id: decoded.userId,
        username: decoded.username,
      });

      await next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new HTTPException(401, { message: 'トークンの有効期限が切れています' });
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new HTTPException(401, { message: '無効なトークンです' });
      } else {
        throw new HTTPException(401, { message: '認証に失敗しました' });
      }
    }
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('認証ミドルウェアでエラーが発生しました:', error);
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' });
  }
};
