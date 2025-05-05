import { db } from '../db';
import { users, User, items, Item, posts, Post, tags, Tag, itemTags, postTags } from '../db/schema';
import { eq, like, or, and, desc, sql } from 'drizzle-orm';

export class SearchService {
  // ユーザー検索
  async searchUsers(query: string): Promise<User[]> {
    const searchTerm = `%${query}%`;
    return await db
      .select()
      .from(users)
      .where(or(like(users.username, searchTerm), like(users.bio, searchTerm)))
      .limit(20)
      .execute();
  }

  // アイテム検索
  async searchItems(query: string): Promise<Item[]> {
    const searchTerm = `%${query}%`;
    return await db
      .select()
      .from(items)
      .where(or(like(items.name, searchTerm), like(items.description, searchTerm)))
      .orderBy(desc(items.createdAt))
      .limit(20)
      .execute();
  }

  // アイテムをタグで検索
  async searchItemsByTag(tagId: number): Promise<Item[]> {
    return await db
      .select({
        id: items.id,
        userId: items.userId,
        name: items.name,
        description: items.description,
        defaultPhotoId: items.defaultPhotoId,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
      })
      .from(items)
      .innerJoin(itemTags, eq(items.id, itemTags.itemId))
      .where(eq(itemTags.tagId, tagId))
      .orderBy(desc(items.createdAt))
      .limit(20)
      .execute();
  }

  // ポスト検索
  async searchPosts(query: string): Promise<Post[]> {
    const searchTerm = `%${query}%`;
    return await db
      .select()
      .from(posts)
      .where(like(posts.content, searchTerm))
      .orderBy(desc(posts.createdAt))
      .limit(20)
      .execute();
  }

  // ポストをタグで検索
  async searchPostsByTag(tagId: number): Promise<Post[]> {
    return await db
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
      .where(eq(postTags.tagId, tagId))
      .orderBy(desc(posts.createdAt))
      .limit(20)
      .execute();
  }

  // タグ検索
  async searchTags(query: string): Promise<Tag[]> {
    const searchTerm = `%${query}%`;
    return await db.select().from(tags).where(like(tags.name, searchTerm)).limit(20).execute();
  }

  // 複合検索 - キーワードによる全体検索
  async searchEverything(query: string): Promise<{
    users: User[];
    items: Item[];
    posts: Post[];
    tags: Tag[];
  }> {
    const [users, items, posts, tags] = await Promise.all([
      this.searchUsers(query),
      this.searchItems(query),
      this.searchPosts(query),
      this.searchTags(query),
    ]);

    return {
      users,
      items,
      posts,
      tags,
    };
  }
}
