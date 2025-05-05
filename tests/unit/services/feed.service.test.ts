import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDb, resetMockDb } from '../../mocks/db';
import { HTTPException } from 'hono/http-exception';

// Branded TypesをモックするためのヘルパーFunction
const mockUserId = (id: number) => id as any;

// DBをモック化
vi.mock('../../../src/db', () => ({
  db: mockDb,
}));

// フィードサービスをインポート
import { getFollowingUsersFeed, getFollowingTagsFeed, getCombinedFeed } from '../../../src/services/feed.service';

describe('Feed Service', () => {
  beforeEach(() => {
    resetMockDb();
    vi.clearAllMocks();
  });

  describe('getFollowingUsersFeed', () => {
    const userId = mockUserId(1);

    it('フォロー中のユーザーがいない場合は空配列を返すこと', async () => {
      // フォロー中のユーザーが0人の場合
      mockDb.execute.mockResolvedValueOnce([]);

      const result = await getFollowingUsersFeed(userId);

      expect(result).toEqual([]);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('フォロー中のユーザーの投稿を返すこと', async () => {
      // フォロー中のユーザーIDを返す
      mockDb.execute.mockResolvedValueOnce([{ followeeId: 2 }, { followeeId: 3 }]);

      // 投稿一覧を返す
      mockDb.execute.mockResolvedValueOnce([
        {
          post: {
            id: 1,
            content: 'Test post 1',
            createdAt: new Date('2023-01-01'),
            itemId: 10,
          },
          author: {
            id: 2,
            username: 'user2',
            avatarUrl: null,
          },
          item: {
            id: 10,
            name: 'Test Item',
          },
          likesCount: 5,
          commentsCount: 2,
        },
      ]);

      // タグ情報を返す
      mockDb.execute.mockResolvedValueOnce([
        {
          tag: {
            id: 1,
            name: 'tag1',
          },
        },
      ]);

      // itemのdefaultPhotoIdを取得
      mockDb.execute.mockResolvedValueOnce([
        {
          defaultPhotoId: 99,
        },
      ]);

      // 写真URLを取得
      mockDb.execute.mockResolvedValueOnce([
        {
          url: 'https://example.com/photo.jpg',
        },
      ]);

      const result = await getFollowingUsersFeed(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 1);
      expect(result[0]).toHaveProperty('content', 'Test post 1');
      expect(result[0].author).toHaveProperty('username', 'user2');
      expect(result[0].item).toHaveProperty('name', 'Test Item');
      expect(result[0].item).toHaveProperty('imageUrl', 'https://example.com/photo.jpg');
      expect(result[0]).toHaveProperty('tags');
      if (result[0].tags) {
        expect(result[0].tags[0]).toHaveProperty('name', 'tag1');
      }
      expect(mockDb.execute).toHaveBeenCalledTimes(5);
    });
  });

  describe('getFollowingTagsFeed', () => {
    const userId = mockUserId(1);

    it('フォロー中のタグがない場合は空配列を返すこと', async () => {
      // フォロー中のタグが0件の場合
      mockDb.execute.mockResolvedValueOnce([]);

      const result = await getFollowingTagsFeed(userId);

      expect(result).toEqual([]);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('フォロー中のタグに関連する投稿を返すこと', async () => {
      // フォロー中のタグを返す
      mockDb.execute.mockResolvedValueOnce([{ tagId: 1 }, { tagId: 2 }]);

      // タグに関連する投稿IDを返す
      mockDb.execute.mockResolvedValueOnce([{ postId: 5 }, { postId: 6 }]);

      // 投稿一覧を返す
      mockDb.execute.mockResolvedValueOnce([
        {
          post: {
            id: 5,
            content: 'Tagged post',
            createdAt: new Date('2023-01-01'),
            itemId: 20,
          },
          author: {
            id: 3,
            username: 'user3',
            avatarUrl: 'avatar.jpg',
          },
          item: {
            id: 20,
            name: 'Tagged Item',
          },
          likesCount: 10,
          commentsCount: 3,
        },
      ]);

      // タグ情報を返す
      mockDb.execute.mockResolvedValueOnce([
        {
          tag: {
            id: 1,
            name: 'tag1',
          },
        },
      ]);

      // itemのdefaultPhotoIdを取得
      mockDb.execute.mockResolvedValueOnce([
        {
          defaultPhotoId: null,
        },
      ]);

      const result = await getFollowingTagsFeed(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 5);
      expect(result[0]).toHaveProperty('content', 'Tagged post');
      expect(result[0].author).toHaveProperty('username', 'user3');
      expect(result[0].item).toHaveProperty('name', 'Tagged Item');
      expect(result[0].item).toHaveProperty('imageUrl', null);
      expect(mockDb.execute).toHaveBeenCalledTimes(5);
    });
  });

  describe('getCombinedFeed', () => {
    const userId = mockUserId(1);

    it('両方のフィード結果を結合して時系列順に返すこと', async () => {
      // フィード関数をモック化
      const usersFeedMock = vi.fn().mockResolvedValue([
        {
          id: 1,
          content: 'User feed post',
          createdAt: new Date('2023-01-02'),
          author: { id: 2, username: 'user2', avatarUrl: null },
          item: { id: 10, name: 'Item 1', imageUrl: null },
          likesCount: 5,
          commentsCount: 2,
          tags: [{ id: 1, name: 'tag1' }],
        },
      ]);

      const tagsFeedMock = vi.fn().mockResolvedValue([
        {
          id: 2,
          content: 'Tag feed post',
          createdAt: new Date('2023-01-01'),
          author: { id: 3, username: 'user3', avatarUrl: null },
          item: { id: 20, name: 'Item 2', imageUrl: null },
          likesCount: 3,
          commentsCount: 1,
          tags: [{ id: 2, name: 'tag2' }],
        },
      ]);

      // モック関数をエクスポート対象の関数に割り当て
      const originalModule = await import('../../../src/services/feed.service');
      vi.spyOn(originalModule, 'getFollowingUsersFeed').mockImplementation(usersFeedMock);
      vi.spyOn(originalModule, 'getFollowingTagsFeed').mockImplementation(tagsFeedMock);

      const result = await getCombinedFeed(userId);

      expect(result).toHaveLength(2);
      // 時系列順に並んでいることを確認
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(usersFeedMock).toHaveBeenCalledWith(userId, 20, 0);
      expect(tagsFeedMock).toHaveBeenCalledWith(userId, 20, 0);
    });
  });
});
