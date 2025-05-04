import { z } from 'zod';

// Branded Typeの定義
declare const brand: unique symbol;
type Brand<T, B> = T & { [brand]: B };

// Branded Type のヘルパー
export const BrandedNumber = <T extends string>(brand: T) => z.coerce.number().int().positive().brand<T>();

// 具体的なBranded Type (Zod スキーマとして定義)
export const UserIdSchema = BrandedNumber('UserId');
export const ItemIdSchema = BrandedNumber('ItemId');
export const PostIdSchema = BrandedNumber('PostId');
export const CommentIdSchema = BrandedNumber('CommentId');
export const TagIdSchema = BrandedNumber('TagId');
export const PhotoIdSchema = BrandedNumber('PhotoId');
export const NotificationIdSchema = BrandedNumber('NotificationId');

// 対応する TypeScript 型
export type UserId = z.infer<typeof UserIdSchema>;
export type ItemId = z.infer<typeof ItemIdSchema>;
export type PostId = z.infer<typeof PostIdSchema>;
export type CommentId = z.infer<typeof CommentIdSchema>;
export type TagId = z.infer<typeof TagIdSchema>;
export type PhotoId = z.infer<typeof PhotoIdSchema>;
export type NotificationId = z.infer<typeof NotificationIdSchema>;
