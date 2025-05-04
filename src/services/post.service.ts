import { db } from '../db';
import { items, posts, users, type NewPost } from '../db/schema';
import { type CreatePostInput } from '../models/post.model';
import { HTTPException } from 'hono/http-exception';
import { and, eq, desc } from 'drizzle-orm';
import type { UserId, ItemId, PostId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, ItemIdSchema, PostIdSchema } from '../types/branded.d';

// Author情報のZodスキーマ定義 (コメントサービスと重複するが、依存を避けるため再定義 or 共通化)
const AuthorInfoSchema = z
  .object({
    id: UserIdSchema,
    username: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .nullable();

// createPost の戻り値スキーマ
const CreatedPostSchema = z.object({
  id: PostIdSchema,
  itemId: ItemIdSchema,
  authorId: UserIdSchema,
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(), // posts テーブルにも updatedAt はある想定
});

// getPostById, getItemPosts の戻り値スキーマ
const PostDetailsSchema = CreatedPostSchema.extend({
  author: AuthorInfoSchema,
  item: z
    .object({
      // 簡易的な Item 情報
      id: ItemIdSchema,
      name: z.string(),
    })
    .nullable(),
});

/**
 * 新しいポストを作成します
 * @param userId 投稿者のユーザーID
 * @param input ポスト作成情報
 * @returns 作成されたポスト
 */
export const createPost = async (userId: UserId, input: CreatePostInput) => {
  // 対応するアイテムが存在し、ユーザーが所有者か確認（仕様によっては不要かも）
  const itemExists = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, input.itemId), eq(items.userId, userId as number)))
    .limit(1);

  if (itemExists.length === 0) {
    throw new HTTPException(404, { message: '指定されたアイテムが見つからないか、投稿権限がありません' });
  }

  const newPost: NewPost = {
    authorId: userId as number,
    itemId: input.itemId as number,
    content: input.content,
    createdAt: new Date(),
  };

  const result = await db.insert(posts).values(newPost).returning();
  const postObject = {
    // DBからの戻り値を整形
    id: result[0].id,
    itemId: result[0].itemId,
    authorId: result[0].authorId,
    content: result[0].content,
    createdAt: result[0].createdAt,
    updatedAt: result[0].updatedAt, // updatedAt も返す
  };

  try {
    return CreatedPostSchema.parse(postObject);
  } catch (error) {
    console.error('Failed to parse created post:', error);
    throw new HTTPException(500, { message: 'ポスト作成後のデータ形式エラー' });
  }
};

/**
 * 指定されたIDのポストを取得します
 * @param postId ポストID
 * @returns ポスト情報（投稿者情報を含む）
 */
export const getPostById = async (postId: PostId) => {
  // db.select() を使って関連情報も取得
  const result = await db
    .select({
      post: {
        id: posts.id,
        itemId: posts.itemId,
        authorId: posts.authorId,
        content: posts.content,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
      },
      author: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
      item: {
        id: items.id,
        name: items.name,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(items, eq(posts.itemId, items.id))
    .where(eq(posts.id, postId as number))
    .limit(1);

  if (result.length === 0) {
    throw new HTTPException(404, { message: '投稿が見つかりませんでした' });
  }
  const data = result[0];

  // 戻り値オブジェクトを作成
  const postDetailObject = {
    id: data.post.id,
    itemId: data.post.itemId,
    authorId: data.post.authorId,
    content: data.post.content,
    createdAt: data.post.createdAt,
    updatedAt: data.post.updatedAt,
    author: data.author, // AuthorInfoSchema でパースされる想定
    item: data.item, // item スキーマでパースされる想定
  };

  try {
    return PostDetailsSchema.parse(postDetailObject);
  } catch (error) {
    console.error(`Failed to parse post detail ID ${postId}:`, error);
    throw new HTTPException(500, { message: 'ポスト詳細取得後のデータ形式エラー' });
  }
};

/**
 * 指定されたアイテムに関連するポスト一覧を取得します
 * @param itemId アイテムID
 * @returns ポスト一覧（投稿者情報を含む）
 */
export const getItemPosts = async (itemId: ItemId) => {
  // db.select() を使って関連情報も取得
  const results = await db
    .select({
      post: {
        id: posts.id,
        itemId: posts.itemId,
        authorId: posts.authorId,
        content: posts.content,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
      },
      author: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
      // アイテム情報は itemId で分かっているので不要かも？
      // スキーマに合わせて item も含めるなら Join する
      item: {
        id: items.id,
        name: items.name,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(items, eq(posts.itemId, items.id)) // Item情報もJOIN
    .where(eq(posts.itemId, itemId as number))
    .orderBy(desc(posts.createdAt));

  // 各ポストをパースして返す (失敗したものは除外)
  return results
    .map((data) => {
      const postDetailObject = {
        id: data.post.id,
        itemId: data.post.itemId,
        authorId: data.post.authorId,
        content: data.post.content,
        createdAt: data.post.createdAt,
        updatedAt: data.post.updatedAt,
        author: data.author,
        item: data.item,
      };
      try {
        return PostDetailsSchema.parse(postDetailObject);
      } catch (error) {
        console.error(`Failed to parse post ID ${data.post.id} for item ${itemId}:`, error);
        return null;
      }
    })
    .filter((post): post is z.infer<typeof PostDetailsSchema> => post !== null);
};
