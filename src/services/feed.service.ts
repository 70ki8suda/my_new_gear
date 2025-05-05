import { db } from '../db';
import { posts, follows, tagFollows, postTags, users, items, tags, photos } from '../db/schema';
import { HTTPException } from 'hono/http-exception';
import { eq, and, desc, sql, or, inArray } from 'drizzle-orm';
import type { UserId, PostId } from '../types/branded.d';
import { z } from 'zod';
import { UserIdSchema, PostIdSchema, ItemIdSchema, TagIdSchema } from '../types/branded.d';

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
  // itemsテーブルからdefaultPhotoIdを取得
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
    columns: {
      defaultPhotoId: true,
    },
  });

  if (!item?.defaultPhotoId) return null;

  // defaultPhotoIdを使って写真情報を取得
  const photo = await db.query.photos.findFirst({
    where: eq(photos.id, item.defaultPhotoId),
    columns: {
      url: true,
    },
  });

  return photo?.url || null;
};

/**
 * フォローしているユーザーの投稿を時系列で取得します
 * @param userId 閲覧ユーザーのID
 * @param limit 取得する投稿数の上限（デフォルト20件）
 * @param offset ページネーション用のオフセット（デフォルト0）
 * @returns フォロー中ユーザーの投稿リスト
 */
export const getFollowingUsersFeed = async (userId: UserId, limit = 20, offset = 0) => {
  try {
    // フォローしているユーザーのIDリストを取得
    const followingUsers = await db
      .select({ followeeId: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, userId as number));

    // フォローしているユーザーがいない場合は空配列を返す
    if (followingUsers.length === 0) {
      return [];
    }

    // フォローしているユーザーのIDのみの配列に変換
    const followingUserIds = followingUsers.map((f) => f.followeeId);

    // フォローしているユーザーの投稿を取得
    const feedPosts = await db
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
        likesCount: sql`(SELECT COUNT(*) FROM likes WHERE likes.post_id = ${posts.id})`.mapWith(Number),
        commentsCount: sql`(SELECT COUNT(*) FROM comments WHERE comments.post_id = ${posts.id})`.mapWith(Number),
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .innerJoin(items, eq(posts.itemId, items.id))
      .where(inArray(posts.authorId, followingUserIds))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    // タグ情報を取得して投稿に追加
    const postsWithTags = await Promise.all(
      feedPosts.map(async (post) => {
        // タグ情報を取得
        const postTagsResult: PostTagResult[] = await db
          .select({
            tag: {
              id: tags.id,
              name: tags.name,
            },
          })
          .from(postTags)
          .innerJoin(tags, eq(postTags.tagId, tags.id))
          .where(eq(postTags.postId, post.post.id));

        const tagsForPost = postTagsResult.map((pt) => pt.tag);

        // アイテムの画像URLを取得
        const imageUrl = await getItemImageUrl(post.post.itemId);

        return {
          ...post.post,
          author: post.author,
          item: {
            ...post.item,
            imageUrl,
          },
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          tags: tagsForPost,
        };
      })
    );

    try {
      return FeedPostsListSchema.parse(postsWithTags);
    } catch (error) {
      console.error('Failed to parse following users feed:', error);
      throw new HTTPException(500, { message: 'フォロー中ユーザーフィードの形式検証に失敗しました' });
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching following users feed:', error);
    throw new HTTPException(500, { message: 'フォロー中ユーザーのフィード取得中にエラーが発生しました' });
  }
};

/**
 * フォローしているタグに関連する投稿を時系列で取得します
 * @param userId 閲覧ユーザーのID
 * @param limit 取得する投稿数の上限（デフォルト20件）
 * @param offset ページネーション用のオフセット（デフォルト0）
 * @returns フォロー中タグの投稿リスト
 */
export const getFollowingTagsFeed = async (userId: UserId, limit = 20, offset = 0) => {
  try {
    // フォローしているタグのIDリストを取得
    const followingTags = await db
      .select({ tagId: tagFollows.tagId })
      .from(tagFollows)
      .where(eq(tagFollows.followerId, userId as number));

    // フォローしているタグがない場合は空配列を返す
    if (followingTags.length === 0) {
      return [];
    }

    // フォローしているタグのIDのみの配列に変換
    const followingTagIds = followingTags.map((f) => f.tagId);

    // 投稿IDを特定するためにpostTagsテーブルから取得
    const postIdsWithTags = await db
      .select({ postId: postTags.postId })
      .from(postTags)
      .where(inArray(postTags.tagId, followingTagIds))
      .groupBy(postTags.postId);

    // 関連投稿がない場合は空配列を返す
    if (postIdsWithTags.length === 0) {
      return [];
    }

    const postIds = postIdsWithTags.map((p) => p.postId);

    // 該当する投稿情報を取得
    const feedPosts = await db
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
        likesCount: sql`(SELECT COUNT(*) FROM likes WHERE likes.post_id = ${posts.id})`.mapWith(Number),
        commentsCount: sql`(SELECT COUNT(*) FROM comments WHERE comments.post_id = ${posts.id})`.mapWith(Number),
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .innerJoin(items, eq(posts.itemId, items.id))
      .where(inArray(posts.id, postIds))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    // タグ情報を取得して投稿に追加
    const postsWithTags = await Promise.all(
      feedPosts.map(async (post) => {
        // タグ情報を取得
        const postTagsResult: PostTagResult[] = await db
          .select({
            tag: {
              id: tags.id,
              name: tags.name,
            },
          })
          .from(postTags)
          .innerJoin(tags, eq(postTags.tagId, tags.id))
          .where(eq(postTags.postId, post.post.id));

        const tagsForPost = postTagsResult.map((pt) => pt.tag);

        // アイテムの画像URLを取得
        const imageUrl = await getItemImageUrl(post.post.itemId);

        return {
          ...post.post,
          author: post.author,
          item: {
            ...post.item,
            imageUrl,
          },
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          tags: tagsForPost,
        };
      })
    );

    try {
      return FeedPostsListSchema.parse(postsWithTags);
    } catch (error) {
      console.error('Failed to parse following tags feed:', error);
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
