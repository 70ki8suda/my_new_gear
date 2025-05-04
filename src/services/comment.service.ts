import { db } from '../db';
import { comments, posts, users, type NewComment } from '../db/schema';
import { type CreateCommentInput } from '../models/comment.model';
import { HTTPException } from 'hono/http-exception';
import { eq, asc } from 'drizzle-orm';
import type { UserId, PostId, CommentId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, PostIdSchema, CommentIdSchema } from '../types/branded.d';
import console from 'console';

// Author情報のZodスキーマ定義
const AuthorInfoSchema = z
  .object({
    id: UserIdSchema,
    username: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .nullable();

// createComment の戻り値スキーマ
const CreatedCommentSchema = z.object({
  id: CommentIdSchema,
  postId: PostIdSchema,
  authorId: UserIdSchema,
  content: z.string(),
  createdAt: z.date(),
  author: AuthorInfoSchema,
});

// getPostComments の要素の戻り値スキーマ
const CommentWithAuthorSchema = z.object({
  id: CommentIdSchema,
  postId: PostIdSchema,
  authorId: UserIdSchema,
  content: z.string(),
  createdAt: z.date(),
  author: AuthorInfoSchema,
});

/**
 * 指定された投稿にコメントを作成します
 * @param userId コメント投稿者のユーザーID
 * @param postId コメント対象の投稿ID
 * @param input コメント作成情報
 * @returns 作成されたコメント
 */
export const createComment = async (userId: UserId, postId: PostId, input: CreateCommentInput) => {
  // 投稿が存在するか確認
  const postExists = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, postId as number))
    .limit(1);
  if (postExists.length === 0) {
    throw new HTTPException(404, { message: 'コメント対象の投稿が見つかりませんでした' });
  }

  // 新しいコメントを作成
  const newComment: NewComment = {
    authorId: userId as number,
    postId: postId as number,
    content: input.content,
    createdAt: new Date(),
  };

  const result = await db.insert(comments).values(newComment).returning();

  // 作成されたコメントに投稿者情報を付加して返す
  const commentData = result[0];
  const authorResult = await db.query.users.findFirst({
    where: eq(users.id, commentData.authorId),
    columns: {
      id: true,
      username: true,
      avatarUrl: true,
    },
  });

  // 取得した Author 情報をパースして型安全にする
  const parsedAuthor = AuthorInfoSchema.safeParse(authorResult);
  const safeAuthor = parsedAuthor.success ? parsedAuthor.data : null;

  const createdCommentObject = {
    id: commentData.id as CommentId,
    postId: commentData.postId as PostId,
    authorId: commentData.authorId as UserId,
    content: commentData.content,
    createdAt: commentData.createdAt,
    author: safeAuthor,
  };

  // 戻り値オブジェクトをスキーマで parse する (失敗時は例外が発生)
  try {
    return CreatedCommentSchema.parse(createdCommentObject);
  } catch (error) {
    console.error('Failed to parse created comment:', error);
    // zod エラーの詳細をログに残すなどの処理を追加できる
    throw new HTTPException(500, { message: 'コメント作成後のデータ形式エラー' });
  }
};

/**
 * 指定された投稿のコメント一覧を取得します
 */
export const getPostComments = async (postId: PostId) => {
  const postExists = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, postId as number))
    .limit(1);
  if (postExists.length === 0) {
    throw new HTTPException(404, { message: '対象の投稿が見つかりませんでした' });
  }

  // db.select() を使用してコメントと投稿者情報を取得
  const results = await db
    .select({
      comment: {
        id: comments.id,
        postId: comments.postId,
        authorId: comments.authorId,
        content: comments.content,
        createdAt: comments.createdAt,
        // comments テーブルに updatedAt は存在しない
      },
      author: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id)) // 投稿者情報を結合
    .where(eq(comments.postId, postId as number))
    .orderBy(asc(comments.createdAt));

  // 結果を整形し、Zodでパース
  return results
    .map((result) => {
      const parsedAuthor = AuthorInfoSchema.safeParse(result.author); // leftJoin の結果 author は null の可能性がある
      const safeAuthor = parsedAuthor.success ? parsedAuthor.data : null;

      const commentObject = {
        id: result.comment.id as CommentId,
        postId: result.comment.postId as PostId,
        authorId: result.comment.authorId as UserId,
        content: result.comment.content,
        createdAt: result.comment.createdAt,
        author: safeAuthor,
      };

      // 各コメントオブジェクトを parse する (失敗時は例外 or null)
      try {
        return CommentWithAuthorSchema.parse(commentObject);
      } catch (error) {
        console.error(`Failed to parse comment ID ${result.comment.id}:`, error);
        return null; // parse に失敗した要素は null にする
      }
    })
    .filter((comment): comment is z.infer<typeof CommentWithAuthorSchema> => comment !== null);
};
