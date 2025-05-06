import { type CreateCommentInput } from '../validators/comment.model';
import { HTTPException } from 'hono/http-exception';
import type { UserId, PostId, CommentId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, PostIdSchema, CommentIdSchema } from '../types/branded.d';
import { commentRepository } from '../repositories/comment.repository';
import { userRepository } from '../repositories/user.repository';
import { postRepository } from '../repositories/post.repository';
import type { User } from '../db/schema';

// Author情報のZodスキーマ定義 (User から必要な情報のみを選択)
const AuthorInfoSchema = z
  .object({
    id: UserIdSchema,
    username: z.string(),
    avatarUrl: z.string().nullable().optional(),
  })
  .nullable();

// createComment の戻り値スキーマ (createdAt は Date 型)
const CreatedCommentSchema = z.object({
  id: CommentIdSchema,
  postId: PostIdSchema,
  authorId: UserIdSchema,
  content: z.string(),
  createdAt: z.date(),
  author: AuthorInfoSchema,
});

// getPostComments の要素の戻り値スキーマ (createdAt は Date 型)
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
 * @returns 作成されたコメント (著者情報付き)
 */
export const createComment = async (userId: UserId, postId: PostId, input: CreateCommentInput) => {
  // 投稿が存在するか確認
  const postExists = await postRepository.findPostById(postId);
  if (!postExists) {
    throw new HTTPException(404, { message: 'コメント対象の投稿が見つかりませんでした' });
  }

  // 新しいコメントを作成
  // NewComment 型は Repository 内部で処理される想定。Service では UserId/PostId をそのまま渡す
  const newComment = {
    authorId: userId,
    postId: postId,
    content: input.content,
  };

  const createdCommentData = await commentRepository.createComment(newComment);

  // 作成されたコメントに投稿者情報を付加して返す
  const author = await userRepository.findUserById(createdCommentData.authorId as UserId); // authorId は UserId のはず

  // 取得した Author 情報をパースして型安全にする (存在しない場合も考慮)
  const parsedAuthor = AuthorInfoSchema.safeParse(author);
  const safeAuthor = parsedAuthor.success ? parsedAuthor.data : null;

  const createdCommentObject = {
    id: createdCommentData.id as CommentId,
    postId: createdCommentData.postId as PostId,
    authorId: createdCommentData.authorId as UserId,
    content: createdCommentData.content,
    createdAt: createdCommentData.createdAt,
    author: safeAuthor,
  };

  // 戻り値オブジェクトをスキーマで parse する (失敗時は例外が発生)
  try {
    return CreatedCommentSchema.parse(createdCommentObject);
  } catch (error) {
    console.error('Failed to parse created comment:', error);
    throw new HTTPException(500, { message: 'コメント作成後のデータ形式エラー' });
  }
};

/**
 * 指定された投稿のコメント一覧を取得します
 * @param postId コメントを取得する投稿ID
 * @returns コメントの配列 (各コメントに著者情報が付加される)
 */
export const getPostComments = async (postId: PostId) => {
  // 投稿が存在するか確認
  const postExists = await postRepository.findPostById(postId);
  if (!postExists) {
    throw new HTTPException(404, { message: '対象の投稿が見つかりませんでした' });
  }

  // コメント一覧を取得
  const commentsOnly = await commentRepository.findCommentsByPostId(postId);

  if (commentsOnly.length === 0) {
    return [];
  }

  // コメント投稿者のIDリストを作成
  const authorIds = commentsOnly.map((comment) => comment.authorId as UserId);
  // 重複を除去
  const uniqueAuthorIds = [...new Set(authorIds)];

  // ユーザー情報を一括取得
  const authors = await userRepository.findUsersByIds(uniqueAuthorIds);
  // ユーザーIDをキーとしたMapを作成 (効率的な検索のため)
  const authorMap = new Map<UserId, User>(authors.map((user) => [user.id as UserId, user]));

  // コメントに著者情報を付加
  const commentsWithAuthors = commentsOnly.map((comment) => {
    const author = authorMap.get(comment.authorId as UserId) ?? null; // 見つからない場合は null
    // AuthorInfoSchema でパースして安全な形式にする
    const parsedAuthor = AuthorInfoSchema.safeParse(author);
    const safeAuthor = parsedAuthor.success ? parsedAuthor.data : null;

    return {
      id: comment.id as CommentId,
      postId: comment.postId as PostId,
      authorId: comment.authorId as UserId,
      content: comment.content,
      createdAt: comment.createdAt,
      author: safeAuthor,
    };
  });

  // 結果配列全体をスキーマで parse する (要素ごとに行う方がエラー箇所特定は容易だが、ここでは一括)
  try {
    return z.array(CommentWithAuthorSchema).parse(commentsWithAuthors);
  } catch (error) {
    console.error('Failed to parse comments with authors:', error);
    throw new HTTPException(500, { message: 'コメント取得後のデータ形式エラー' });
  }
};

/**
 * 指定されたコメントを削除します。
 * 削除を実行できるのはコメントの作成者のみです。
 * @param commentId 削除するコメントのID
 * @param userId 削除操作を行うユーザーのID
 * @throws {HTTPException} コメントが見つからない(404)、権限がない(403)、削除に失敗(500)した場合
 */
export const deleteComment = async (commentId: CommentId, userId: UserId): Promise<void> => {
  // 1. コメントを取得して存在確認
  const comment = await commentRepository.findCommentById(commentId);
  if (!comment) {
    throw new HTTPException(404, { message: '削除対象のコメントが見つかりませんでした' });
  }

  // 3. 所有者確認
  if (comment.authorId !== userId) {
    throw new HTTPException(403, { message: 'コメントを削除する権限がありません' });
  }

  // 5. コメント削除
  const deleted = await commentRepository.deleteComment(commentId, userId);

  // 6. 削除結果確認 (リポジトリ層で既に所有者確認込みで削除しているので、基本的には成功するはず)
  if (!deleted) {
    // ここに来ることは稀だが、念のためエラーハンドリング
    console.error(`Failed to delete comment ${commentId} even after ownership check.`);
    throw new HTTPException(500, { message: 'コメントの削除に失敗しました' });
  }

  // 7. 成功 (void なので return なし)
};

// TODO: Add updateComment function? (less common for comments)
