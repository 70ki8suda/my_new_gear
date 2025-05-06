import { db } from '../db';
import { posts, follows, tagFollows, postTags, users, items, tags, photos } from '../db/schema';
import { HTTPException } from 'hono/http-exception';
import { eq, and, desc, sql, or, inArray } from 'drizzle-orm';
import type { UserId, PostId, ItemId, TagId, PhotoId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, PostIdSchema, ItemIdSchema, TagIdSchema } from '../types/branded.d';
import { followRepository } from '../repositories/follow.repository';
import { postRepository } from '../repositories/post.repository';
import { postTagRepository } from '../repositories/postTag.repository';
import { photoRepository } from '../repositories/photo.repository';
import { itemRepository } from '../repositories/item.repository';
import type { PostForFeed } from '../repositories/post.repository';
import type { Tag } from '../db/schema';
import { tagFollowRepository } from '../repositories/tagFollow.repository';

// タグの型定義
type TagInfo = {
  id: number;
  name: string;
};

// 投稿タグの型定義
type PostTagResult = {
  tag: TagInfo;
};

// フィード内の投稿情報のスキーマ
const FeedPostSchema = z.object({
  id: PostIdSchema,
  content: z.string(),
  createdAt: z.date(),
  author: z.object({
    id: UserIdSchema,
    username: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  item: z.object({
    id: ItemIdSchema,
    name: z.string(),
    imageUrl: z.string().nullable(),
  }),
  likesCount: z.number().int().min(0),
  commentsCount: z.number().int().min(0),
  tags: z
    .array(
      z.object({
        id: TagIdSchema,
        name: z.string(),
      })
    )
    .optional(),
});

// フィード一覧の戻り値スキーマ
const FeedPostsListSchema = z.array(FeedPostSchema);

/**
 * アイテムのデフォルト画像URLを取得する補助関数
 * @param itemId アイテムID
 * @returns 画像URL（存在しない場合はnull）
 */
const getItemImageUrl = async (itemId: number): Promise<string | null> => {
  const item = await itemRepository.findItemById(itemId as ItemId);
  if (!item?.defaultPhotoId) return null;

  const photo = await photoRepository.findPhotoById(item.defaultPhotoId as PhotoId);
  return photo?.url ?? null;
};

/**
 * フォローしているユーザーの投稿を時系列で取得します
 * @param userId 閲覧ユーザーのID
 * @param limit 取得する投稿数の上限（デフォルト20件）
 * @param offset ページネーション用のオフセット（デフォルト0）
 * @returns フォロー中ユーザーの投稿リスト
 */
export const getFollowingUsersFeed = async (
  userId: UserId,
  limit = 20,
  offset = 0
): Promise<z.infer<typeof FeedPostsListSchema>> => {
  const followingUserIds = await followRepository.findFollowingIds(userId);
  if (followingUserIds.length === 0) {
    return [];
  }

  const postIdsResult = await db
    .select({ id: posts.id })
    .from(posts)
    .where(inArray(posts.authorId, followingUserIds as number[]))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
  const postIds = postIdsResult.map((p) => p.id as PostId);
  if (postIds.length === 0) return [];

  const postsForFeed = await postRepository.findPostsForFeedByIds(postIds);

  const tagsMap = await postTagRepository.findTagsForMultiplePosts(postIds);

  const feedResults = await Promise.all(
    postsForFeed.map(async (post) => {
      const tags = tagsMap.get(post.id as PostId) ?? [];
      const imageUrl = post.item?.id ? await getItemImageUrl(post.item.id as number) : null;

      return {
        id: post.id as PostId,
        content: post.content,
        createdAt: post.createdAt,
        author: post.author
          ? {
              id: post.author.id as UserId,
              username: post.author.username,
              avatarUrl: post.author.avatarUrl,
            }
          : null,
        item: post.item
          ? {
              id: post.item.id as ItemId,
              name: post.item.name,
              imageUrl: imageUrl,
            }
          : null,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        tags: tags.map((t) => ({ id: t.id as TagId, name: t.name })),
      };
    })
  );

  const postIdOrder = new Map(postIds.map((id, index) => [id, index]));
  feedResults.sort((a, b) => (postIdOrder.get(a.id) ?? Infinity) - (postIdOrder.get(b.id) ?? Infinity));

  try {
    return FeedPostsListSchema.parse(feedResults);
  } catch (error) {
    console.error('Failed to parse following users feed:', error);
    if (error instanceof z.ZodError) {
      console.error('Zod Errors:', JSON.stringify(error.errors, null, 2));
    }
    throw new HTTPException(500, { message: 'フォロー中ユーザーフィードの形式検証に失敗しました' });
  }
};

/**
 * フォローしているタグに関連する投稿を時系列で取得します
 * @param userId 閲覧ユーザーのID
 * @param limit 取得する投稿数の上限（デフォルト20件）
 * @param offset ページネーション用のオフセット（デフォルト0）
 * @returns フォロー中タグの投稿リスト
 */
export const getFollowingTagsFeed = async (
  userId: UserId,
  limit = 20,
  offset = 0
): Promise<z.infer<typeof FeedPostsListSchema>> => {
  try {
    // 1. フォローしているタグIDリストを取得
    const followingTagIds = await tagFollowRepository.findFollowingTagIds(userId);
    if (followingTagIds.length === 0) {
      return [];
    }

    // 2. フォロー中タグが付与された投稿IDリストを取得 (ここでは全件取得)
    // TODO: パフォーマンス向上のため、本来はDBレベルでページネーションすべき
    //       例: PostTagRepository に findPostIdsByTagIdsWithPagination を追加
    const postIdsWithTags = await postTagRepository.findPostIdsByTagIds(followingTagIds);
    if (postIdsWithTags.length === 0) {
      return [];
    }
    const postIds = postIdsWithTags.map((p) => p as number);

    // 3. 投稿IDに基づき、DBクエリでページネーションしつつ投稿情報を取得
    const postsForFeed = await db
      .select({
        post: {
          id: posts.id,
          content: posts.content,
          createdAt: posts.createdAt,
          itemId: posts.itemId,
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
        // COUNT(*) は BigInt を返す可能性があるため Number でキャスト
        likesCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.post_id = ${posts.id})`.mapWith(Number),
        commentsCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE comments.post_id = ${posts.id})`.mapWith(
          Number
        ),
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .innerJoin(items, eq(posts.itemId, items.id))
      .where(inArray(posts.id, postIds)) // 取得した投稿IDリストでフィルタ
      .orderBy(desc(posts.createdAt)) // 作成日時で降順ソート
      .limit(limit) // 取得件数制限
      .offset(offset); // オフセット指定

    if (postsForFeed.length === 0) return [];

    // ページネーションされた結果の投稿IDリストを取得
    const paginatedPostIds = postsForFeed.map((p) => p.post.id as PostId);

    // 4. 取得した投稿のタグ情報を取得
    const tagsMap = await postTagRepository.findTagsForMultiplePosts(paginatedPostIds);

    // 5. 取得した情報を整形 (getItemImageUrl を使用)
    const feedResults = await Promise.all(
      postsForFeed.map(async (p) => {
        const tags = tagsMap.get(p.post.id as PostId) ?? [];
        // アイテムが存在する場合のみ画像URLを取得
        const imageUrl = p.post.itemId ? await getItemImageUrl(p.post.itemId as number) : null;

        return {
          id: p.post.id as PostId,
          content: p.post.content,
          createdAt: p.post.createdAt,
          author: p.author
            ? {
                id: p.author.id as UserId,
                username: p.author.username,
                avatarUrl: p.author.avatarUrl,
              }
            : null, // author が null の場合も考慮 (DB制約上はありえないが念のため)
          item: p.item
            ? {
                id: p.item.id as ItemId,
                name: p.item.name,
                imageUrl: imageUrl,
              }
            : null, // item が null の場合も考慮 (DB制約上はありえないが念のため)
          likesCount: p.likesCount,
          commentsCount: p.commentsCount,
          tags: tags.map((t) => ({ id: t.id as TagId, name: t.name })),
        };
      })
    );

    // 6. Zod スキーマで検証して返す
    try {
      // 元のDBクエリ順序を保持するためにソートは不要
      // postIdOrder は getFollowingUsersFeed の実装詳細であり、ここでは不要
      return FeedPostsListSchema.parse(feedResults);
    } catch (error) {
      console.error('Failed to parse following tags feed:', error);
      if (error instanceof z.ZodError) {
        console.error('Zod Errors:', JSON.stringify(error.errors, null, 2));
      }
      throw new HTTPException(500, { message: 'フォロー中タグフィードの形式検証に失敗しました' });
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching following tags feed:', error);
    throw new HTTPException(500, { message: 'フォロー中タグのフィード取得中にエラーが発生しました' });
  }
};

/**
 * フォローしているユーザーの投稿とフォロー中のタグに関連する投稿を統合して時系列で取得します
 * @param userId 閲覧ユーザーのID
 * @param limit 取得する投稿数の上限（デフォルト20件）
 * @param offset ページネーション用のオフセット（デフォルト0）
 * @returns 統合されたフィードの投稿リスト
 */
export const getCombinedFeed = async (userId: UserId, limit = 20, offset = 0) => {
  // TODO: パフォーマンスに関する懸念
  // 現在の実装では、各フィードから最大100件ずつ取得し、メモリ上でマージ、ソート、
  // ページネーションを行っている。データ量が増加すると、メモリ使用量と処理時間が増大する
  // 可能性がある。将来的には、データベースレベルで UNION やサブクエリを用いて、
  // 必要な ID のみを効率的に取得し、ページネーションする方式を検討すべき。
  try {
    // フォロー中のユーザーとタグの両方のフィードを取得
    const usersFeed = await getFollowingUsersFeed(userId, 100, 0); // より多くの投稿を取得して後でマージ
    const tagsFeed = await getFollowingTagsFeed(userId, 100, 0);

    // 両方のフィードを結合
    const combinedFeed = [...usersFeed, ...tagsFeed];

    // 投稿IDによる重複を排除（同じ投稿がユーザーフィードとタグフィードの両方に現れる可能性がある）
    const uniquePosts = Array.from(new Map(combinedFeed.map((post) => [post.id, post])).values());

    // 日付で降順ソート
    const sortedPosts = uniquePosts.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 指定された範囲の投稿を返す
    const paginatedPosts = sortedPosts.slice(offset, offset + limit);

    try {
      return FeedPostsListSchema.parse(paginatedPosts);
    } catch (error) {
      console.error('Failed to parse combined feed:', error);
      throw new HTTPException(500, { message: '統合フィードの形式検証に失敗しました' });
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching combined feed:', error);
    throw new HTTPException(500, { message: '統合フィードの取得中にエラーが発生しました' });
  }
};
