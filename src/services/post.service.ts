import { db } from '../db';
import { items, posts, users, type NewPost } from '../db/schema';
import { type CreatePostInput } from '../models/post.model';
import { HTTPException } from 'hono/http-exception';
import { and, eq, desc } from 'drizzle-orm';

/**
 * 新しいポストを作成します
 * @param userId 投稿者のユーザーID
 * @param input ポスト作成情報
 * @returns 作成されたポスト
 */
export const createPost = async (userId: number, input: CreatePostInput) => {
  // 対応するアイテムが存在し、ユーザーが所有者か確認（仕様によっては不要かも）
  const itemExists = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, input.itemId), eq(items.userId, userId)))
    .limit(1);

  if (itemExists.length === 0) {
    throw new HTTPException(404, { message: '指定されたアイテムが見つからないか、投稿権限がありません' });
  }

  const newPost: NewPost = {
    authorId: userId,
    itemId: input.itemId,
    content: input.content,
    createdAt: new Date(),
  };

  const result = await db.insert(posts).values(newPost).returning();
  return result[0];
};

/**
 * 指定されたIDのポストを取得します
 * @param postId ポストID
 * @returns ポスト情報（投稿者情報を含む）
 */
export const getPostById = async (postId: number) => {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: {
      author: {
        columns: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      item: {
        columns: {
          id: true,
          name: true,
        },
      },
      // TODO: いいね数、コメント数、写真などを追加
    },
  });

  if (!post) {
    throw new HTTPException(404, { message: '投稿が見つかりませんでした' });
  }

  return post;
};

/**
 * 指定されたアイテムに関連するポスト一覧を取得します
 * @param itemId アイテムID
 * @returns ポスト一覧（投稿者情報を含む）
 */
export const getItemPosts = async (itemId: number) => {
  const itemPosts = await db.query.posts.findMany({
    where: eq(posts.itemId, itemId),
    orderBy: [desc(posts.createdAt)],
    with: {
      author: {
        columns: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      // TODO: いいね数、コメント数などを追加
    },
  });

  return itemPosts;
};
