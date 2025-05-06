import { db } from '../db';
import { postTags, tags, NewPostTag, PostTag } from '../db/schema';
import { eq, inArray, and } from 'drizzle-orm'; // and を追加
import type { PostId, TagId } from '../types/branded.d';
import type { Tag } from '../db/schema';

export const postTagRepository = {
  /**
   * 投稿にタグを追加します。
   * @param postId タグを追加する投稿ID
   * @param tagId 追加するタグID
   * @returns 作成された PostTag オブジェクト
   */
  async addTagToPost(postId: PostId, tagId: TagId): Promise<PostTag> {
    const newPostTag: NewPostTag = {
      postId: postId as number,
      tagId: tagId as number,
      // addedAt は DB デフォルト
    };
    // 既に存在するか確認するロジックを追加しても良い
    const result = await db.insert(postTags).values(newPostTag).returning();
    if (result.length === 0) {
      throw new Error('Failed to add tag to post or retrieve returning values.');
    }
    return result[0];
  },

  /**
   * 投稿からタグを削除します。
   * @param postId タグを削除する投稿ID
   * @param tagId 削除するタグID
   * @returns 削除が成功した場合は true, 失敗した場合は false
   */
  async removeTagFromPost(postId: PostId, tagId: TagId): Promise<boolean> {
    const result = await db
      .delete(postTags)
      .where(and(eq(postTags.postId, postId as number), eq(postTags.tagId, tagId as number)))
      .returning({ postId: postTags.postId }); // returning で削除を確認 (カラム名は postId でも可)
    return result.length > 0;
  },

  /**
   * 指定された投稿IDに紐づくタグのリストを取得します。
   * @param postId 投稿ID
   * @returns Tag オブジェクトの配列
   */
  async findTagsByPostId(postId: PostId): Promise<Tag[]> {
    // postTags から tagId を取得し、tags テーブルを JOIN してタグ情報を取得
    const results = await db
      .select({
        id: tags.id,
        name: tags.name,
        createdAt: tags.createdAt,
        // 他に必要な tags テーブルのカラムがあれば追加
      })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, postId as number));

    // Tag 型にキャスト (必要であれば)
    return results as Tag[];
  },

  /**
   * 指定された複数の投稿IDに紐づくタグを一括取得します。
   * @param postIds 投稿IDの配列
   * @returns Map<PostId, Tag[]> postId をキー、Tag オブジェクトの配列を値とする Map
   */
  async findTagsForMultiplePosts(postIds: PostId[]): Promise<Map<PostId, Tag[]>> {
    if (postIds.length === 0) {
      return new Map();
    }
    const numericPostIds = postIds as number[];

    const results = await db
      .select({
        postId: postTags.postId,
        tagId: tags.id,
        tagName: tags.name,
        tagCreatedAt: tags.createdAt,
      })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(inArray(postTags.postId, numericPostIds));

    const tagsByPostId = new Map<PostId, Tag[]>();
    for (const row of results) {
      const postId = row.postId as PostId;
      const tag: Tag = {
        id: row.tagId as TagId,
        name: row.tagName,
        createdAt: row.tagCreatedAt,
      };
      if (!tagsByPostId.has(postId)) {
        tagsByPostId.set(postId, []);
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      tagsByPostId.get(postId)!.push(tag);
    }
    return tagsByPostId;
  },

  /**
   * 指定されたタグIDリストのいずれかを持つ投稿IDのリストを取得します。
   * @param tagIds タグIDの配列
   * @param limit 取得件数
   * @param offset 取得開始位置
   * @returns PostId の配列
   */
  async findPostIdsByTagIds(tagIds: TagId[], limit: number = 50, offset: number = 0): Promise<PostId[]> {
    if (tagIds.length === 0) {
      return [];
    }
    const numericTagIds = tagIds as number[];

    // SELECT DISTINCT postId ... としたいが Drizzle での書き方が不明瞭な場合、
    // 一旦全て取得して Set で重複排除する
    const results = await db
      .select({ postId: postTags.postId })
      .from(postTags)
      .where(inArray(postTags.tagId, numericTagIds))
      // ORDER BY や LIMIT/OFFSET は投稿取得時に行う方が適切かもしれない
      // .orderBy(?) // 何でソートするか？
      .limit(limit) // ここで limit/offset するかは要検討
      .offset(offset);

    const uniquePostIds = [...new Set(results.map((r) => r.postId as PostId))];
    return uniquePostIds;
    // TODO: パフォーマンス懸念がある場合、DISTINCT を使ったクエリに修正
  },
};
