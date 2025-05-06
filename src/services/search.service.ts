import { userRepository } from '../repositories/user.repository';
import { itemRepository } from '../repositories/item.repository';
import { postRepository } from '../repositories/post.repository';
import { tagRepository } from '../repositories/tag.repository';
import type { User, Item, Post, Tag } from '../db/schema';
import type { TagId } from '../types/branded.d';

// ユーザー検索
export const searchUsers = async (query: string, limit: number = 20): Promise<User[]> => {
  return userRepository.searchUsersByQuery(query, limit);
};

// アイテム検索 (キーワード)
export const searchItems = async (query: string, limit: number = 20): Promise<Item[]> => {
  return itemRepository.searchItemsByQuery(query, limit);
};

// アイテム検索 (タグID)
export const searchItemsByTag = async (tagId: TagId, limit: number = 20): Promise<Item[]> => {
  // TagId を number として渡す必要があるか確認 (リポジトリ側でキャストしているはず)
  return itemRepository.searchItemsByTagId(tagId, limit);
};

// ポスト検索 (キーワード)
export const searchPosts = async (query: string, limit: number = 20): Promise<Post[]> => {
  return postRepository.searchPostsByQuery(query, limit);
};

// ポスト検索 (タグID)
export const searchPostsByTag = async (tagId: TagId, limit: number = 20): Promise<Post[]> => {
  // TagId を number として渡す必要があるか確認 (リポジトリ側でキャストしているはず)
  return postRepository.searchPostsByTagId(tagId, limit);
};

// タグ検索 (キーワード)
export const searchTags = async (query: string, limit: number = 20): Promise<Tag[]> => {
  return tagRepository.searchTagsByQuery(query, limit);
};

// 複合検索 - キーワードによる全体検索
export const searchEverything = async (
  query: string,
  limit: number = 20
): Promise<{
  users: User[];
  items: Item[];
  posts: Post[];
  tags: Tag[];
}> => {
  // 各リポジトリの検索メソッドを並列で呼び出す
  const [users, items, posts, tags] = await Promise.all([
    userRepository.searchUsersByQuery(query, limit),
    itemRepository.searchItemsByQuery(query, limit),
    postRepository.searchPostsByQuery(query, limit),
    tagRepository.searchTagsByQuery(query, limit),
  ]);

  return {
    users,
    items,
    posts,
    tags,
  };
};

// 特定のタイプのみ検索する関数 (オプション)
export const searchByType = async (
  query: string,
  type: 'users' | 'items' | 'posts' | 'tags',
  limit: number = 20
): Promise<User[] | Item[] | Post[] | Tag[]> => {
  switch (type) {
    case 'users':
      return searchUsers(query, limit);
    case 'items':
      return searchItems(query, limit);
    case 'posts':
      return searchPosts(query, limit);
    case 'tags':
      return searchTags(query, limit);
    default:
      // 不正なタイプの場合は空配列を返すか、エラーをスローする
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = type;
      return [];
  }
};
