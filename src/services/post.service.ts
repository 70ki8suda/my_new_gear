import { type CreatePostInput } from '../validators/post.model';
import { HTTPException } from 'hono/http-exception';
import type { UserId, ItemId, PostId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, ItemIdSchema, PostIdSchema } from '../types/branded.d';
import { postRepository } from '../repositories/post.repository';
import { itemRepository } from '../repositories/item.repository';
import { userRepository } from '../repositories/user.repository';
import type { User, Item } from '../db/schema';

// Author情報のZodスキーマ定義
const AuthorInfoSchema = z
  .object({
    id: UserIdSchema,
    username: z.string(),
    avatarUrl: z.string().nullable().optional(),
  })
  .nullable();

// Item簡易情報のZodスキーマ定義 (ここに移動)
const ItemSummarySchema = z
  .object({
    id: ItemIdSchema,
    name: z.string(),
  })
  .nullable();

// createPost の戻り値スキーマ (author, item を削除)
const CreatedPostSchema = z.object({
  id: PostIdSchema,
  itemId: ItemIdSchema,
  authorId: UserIdSchema,
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

// getPostById, getItemPosts の戻り値スキーマ (独立定義 - こちらを残す)
const PostDetailsSchema = z.object({
  id: PostIdSchema,
  itemId: ItemIdSchema,
  authorId: UserIdSchema,
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  author: AuthorInfoSchema, // ここでは必須
  item: ItemSummarySchema, // ここでは必須
});

// TODO: Add updatePost (requires checking ownership)
// TODO: Add deletePost (requires checking ownership)
// TODO: Add photo handling to createPost/updatePost

/**
 * 新しいポストを作成します
 * @param userId 投稿者のユーザーID
 * @param input ポスト作成情報 (itemId を含む)
 * @returns 作成されたポスト
 */
export const createPost = async (userId: UserId, input: CreatePostInput) => {
  // 対応するアイテムが存在し、ユーザーが所有者か確認
  const item = await itemRepository.findItemById(input.itemId);
  if (!item) {
    throw new HTTPException(404, { message: '指定されたアイテムが見つかりません' });
  }
  // アイテム所有者チェック (サービス層の責務)
  if (item.userId !== userId) {
    throw new HTTPException(403, { message: 'このアイテムへの投稿権限がありません' });
  }

  const newPostData = {
    authorId: userId,
    itemId: input.itemId,
    content: input.content,
    // createdAt, updatedAt はリポジトリ層またはDBデフォルトで設定される想定
  };

  // postRepository を使用してポストを作成
  const createdPost = await postRepository.createPost(newPostData);

  // DBからの戻り値 (Post 型) を CreatedPostSchema に合わせて整形
  const postObject = {
    id: createdPost.id as PostId,
    itemId: createdPost.itemId as ItemId,
    authorId: createdPost.authorId as UserId,
    content: createdPost.content,
    createdAt: createdPost.createdAt,
    updatedAt: createdPost.updatedAt,
  };

  try {
    // Zod スキーマでパースして返す (CreatedPostSchema は author/item を要求しない)
    return CreatedPostSchema.parse(postObject);
  } catch (error) {
    console.error('Failed to parse created post:', error);
    throw new HTTPException(500, { message: 'ポスト作成後のデータ形式エラー' });
  }
};

/**
 * 指定されたIDのポストを取得します
 * @param postId ポストID
 * @returns ポスト情報（投稿者情報、アイテム簡易情報を含む）
 */
export const getPostById = async (postId: PostId) => {
  // 1. ポスト基本情報を取得
  const post = await postRepository.findPostById(postId);
  if (!post) {
    throw new HTTPException(404, { message: '投稿が見つかりませんでした' });
  }

  // 2. 投稿者情報を取得
  const author = await userRepository.findUserById(post.authorId as UserId);
  // 著者が見つからないケースも考慮 (DB不整合など)
  const safeAuthor = AuthorInfoSchema.safeParse(author);

  // 3. アイテム簡易情報を取得
  const item = await itemRepository.findItemById(post.itemId as ItemId);
  // アイテムが見つからないケースも考慮
  const safeItem = ItemSummarySchema.safeParse(item ? { id: item.id, name: item.name } : null);

  // 4. 結合して PostDetailsSchema に合わせて整形
  const postDetailObject = {
    id: post.id as PostId,
    itemId: post.itemId as ItemId,
    authorId: post.authorId as UserId,
    content: post.content,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: safeAuthor.success ? safeAuthor.data : null,
    item: safeItem.success ? safeItem.data : null,
  };

  try {
    // Zod スキーマでパースして返す
    return PostDetailsSchema.parse(postDetailObject);
  } catch (error) {
    console.error(`Failed to parse post detail ID ${postId}:`, error);
    throw new HTTPException(500, { message: 'ポスト詳細取得後のデータ形式エラー' });
  }
};

/**
 * 指定されたアイテムに関連するポスト一覧を取得します
 * @param itemId アイテムID
 * @returns ポスト一覧（投稿者情報、アイテム簡易情報を含む）
 */
export const getItemPosts = async (itemId: ItemId) => {
  // 0. アイテムが存在するか、簡易情報を取得 (リスト内の全ポストで共通)
  const item = await itemRepository.findItemById(itemId);
  if (!item) {
    // アイテムが存在しない場合は空リストを返すか、404エラーを投げるか（ここでは空リスト）
    // throw new HTTPException(404, { message: '指定されたアイテムが見つかりません' });
    return [];
  }
  const safeItem = ItemSummarySchema.safeParse({ id: item.id, name: item.name });
  const itemSummary = safeItem.success ? safeItem.data : null;

  // 1. アイテムに紐づくポスト一覧を取得 (リポジトリは Post[] を返す想定)
  const postsList = await postRepository.findPostsByItemId(itemId);
  if (postsList.length === 0) {
    return [];
  }

  // 2. 投稿者のIDリストを作成し、ユーザー情報を一括取得
  const authorIds = postsList.map((p) => p.authorId as UserId);
  const uniqueAuthorIds = [...new Set(authorIds)];
  const authors = await userRepository.findUsersByIds(uniqueAuthorIds);
  const authorMap = new Map<UserId, User>(authors.map((u) => [u.id as UserId, u]));

  // 3. ポストリストと著者情報を結合して PostDetailsSchema の配列を作成
  const postsWithDetails = postsList
    .map((post) => {
      const author = authorMap.get(post.authorId as UserId) ?? null;
      const safeAuthor = AuthorInfoSchema.safeParse(author);

      const postDetailObject = {
        id: post.id as PostId,
        itemId: post.itemId as ItemId,
        authorId: post.authorId as UserId,
        content: post.content,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: safeAuthor.success ? safeAuthor.data : null,
        item: itemSummary, // 全ポストで共通のアイテム情報
      };

      // 各ポストをパース (不正なデータは除外)
      try {
        return PostDetailsSchema.parse(postDetailObject);
      } catch (error) {
        console.error(`Failed to parse post ID ${post.id} for item ${itemId}:`, error);
        return null;
      }
    })
    .filter((p): p is z.infer<typeof PostDetailsSchema> => p !== null);

  return postsWithDetails;
};
