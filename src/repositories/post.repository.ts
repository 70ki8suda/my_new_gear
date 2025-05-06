import { db } from '../db';
import { posts, NewPost, Post, users, items, likes, comments, postTags } from '../db/schema';
import { eq, desc, asc, and, inArray, sql, or, like } from 'drizzle-orm';
import type { ItemId, PostId, UserId, TagId } from '../types/branded.d';
import type { User, Item } from '../db/schema';

// findPostsForFeedByIds の戻り値の型を定義
export type PostForFeed = Post & {
  author: Pick<User, 'id' | 'username' | 'avatarUrl'> | null; // 著者情報 (一部)
  item: Pick<Item, 'id' | 'name'> | null; // アイテム情報 (一部)
  likesCount: number;
  commentsCount: number;
};

export const postRepository = {
  /**
   * 新しい投稿を作成します。
   * @param newPost 作成する投稿データ (NewPost 型)
   * @returns 作成された投稿オブジェクト (Post 型)
   */
  async createPost(newPost: NewPost): Promise<Post> {
    const result = await db.insert(posts).values(newPost).returning();
    if (result.length === 0) {
      throw new Error('Failed to create post or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * 投稿IDで投稿を検索します。
   * @param postId 検索する投稿ID
   * @returns 投稿オブジェクト、見つからない場合は null
   */
  async findPostById(postId: PostId): Promise<Post | null> {
    const result = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    return result[0] ?? null;
  },

  /**
   * アイテムIDに紐づく投稿一覧を取得します。
   * @param itemId 投稿を取得するアイテムID
   * @param limit 取得件数
   * @param offset 取得開始位置
   * @param orderBy ソート順 ('asc' または 'desc') デフォルトは 'desc' (新しい順)
   * @returns 投稿オブジェクトの配列
   */
  async findPostsByItemId(
    itemId: ItemId,
    limit: number = 50,
    offset: number = 0,
    orderBy: 'asc' | 'desc' = 'desc'
  ): Promise<Post[]> {
    const orderFunction = orderBy === 'desc' ? desc : asc;
    const result = await db
      .select()
      .from(posts)
      .where(eq(posts.itemId, itemId))
      .orderBy(orderFunction(posts.createdAt)) // 作成日時順でソート
      .limit(limit)
      .offset(offset);
    return result;
  },

  /**
   * 投稿を削除します (投稿者のみ可能)。
   * @param postId 削除する投稿ID
   * @param authorId 所有者確認のためのユーザーID
   * @returns 削除に成功した場合は true, 見つからない/権限がない場合は false
   */
  async deletePost(postId: PostId, authorId: UserId): Promise<boolean> {
    const result = await db
      .delete(posts)
      .where(and(eq(posts.id, postId), eq(posts.authorId, authorId))) // `and` を使うためにインポートが必要
      .returning({ id: posts.id });
    return result.length > 0;
  },

  /**
   * 複数の投稿IDで投稿情報を一括取得します。
   * @param ids 検索する投稿IDの配列
   * @returns 投稿オブジェクトの配列
   */
  async findPostsByIds(ids: PostId[]): Promise<Post[]> {
    if (ids.length === 0) {
      return [];
    }
    // PostId[] を number[] にキャスト
    const numericIds = ids as number[];
    return db.select().from(posts).where(inArray(posts.id, numericIds));
  },

  /**
   * 複数の投稿IDで、フィード表示に必要な情報（著者、アイテム、いいね数、コメント数）を含めて投稿を取得します。
   * @param ids 検索する投稿IDの配列
   * @returns PostForFeed オブジェクトの配列
   */
  async findPostsForFeedByIds(ids: PostId[]): Promise<PostForFeed[]> {
    if (ids.length === 0) return [];
    const numericIds = ids as number[];

    const results = await db
      .select({
        // posts テーブルのカラムを明示的に指定
        id: posts.id,
        itemId: posts.itemId,
        authorId: posts.authorId,
        content: posts.content,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        // author 情報を選択
        author: {
          id: users.id,
          username: users.username,
          avatarUrl: users.avatarUrl,
        },
        // item 情報を選択
        item: {
          id: items.id,
          name: items.name,
        },
        // likesCount をサブクエリで取得
        likesCount: sql<number>`(SELECT COUNT(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id})`.mapWith(Number),
        // commentsCount をサブクエリで取得
        commentsCount: sql<number>`(SELECT COUNT(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id})`.mapWith(
          Number
        ),
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .leftJoin(items, eq(posts.itemId, items.id))
      .where(inArray(posts.id, numericIds));

    // 型アサーションを追加
    return results as PostForFeed[];
  },

  /**
   * ポストのコンテンツに基づいてポストを検索します。
   * @param query 検索クエリ
   * @param limit 取得上限数 (デフォルト 20)
   * @returns ポストオブジェクトの配列
   */
  async searchPostsByQuery(query: string, limit: number = 20): Promise<Post[]> {
    const searchTerm = `%${query}%`;
    // Post 型のスキーマに一致するようカラムを取得 (select() のみだと JOIN しない限り全カラム取得)
    return db.select().from(posts).where(like(posts.content, searchTerm)).orderBy(desc(posts.createdAt)).limit(limit);
  },

  /**
   * 指定されたタグ ID に紐づくポストを検索します。
   * @param tagId タグID
   * @param limit 取得上限数 (デフォルト 20)
   * @returns ポストオブジェクトの配列
   */
  async searchPostsByTagId(tagId: TagId, limit: number = 20): Promise<Post[]> {
    // Post 型に必要なカラムを明示的に指定
    return db
      .select({
        id: posts.id,
        itemId: posts.itemId,
        authorId: posts.authorId,
        content: posts.content,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .innerJoin(postTags, eq(posts.id, postTags.postId))
      .where(eq(postTags.tagId, tagId as number)) // TagId を number にキャスト
      .orderBy(desc(posts.createdAt))
      .limit(limit);
  },

  // TODO: Update post?
  // TODO: Find posts by user ID?
  // TODO: Get posts for feed (complex query)? - Might belong in service layer or dedicated feed repository
};
