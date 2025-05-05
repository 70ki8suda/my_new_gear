import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { SearchService } from '../services/search.service';
import { authMiddleware } from '../middlewares/auth.middleware';

const searchRouter = new Hono();
const searchService = new SearchService();

// 認証ミドルウェアを適用
searchRouter.use('*', authMiddleware);

// 検索クエリのスキーマ
const searchQuerySchema = z.object({
  q: z.string().min(2).max(50),
});

// タグIDのスキーマ
const tagIdSchema = z.object({
  tagId: z.coerce.number().int().positive(),
});

// ユーザー検索
searchRouter.get('/users', zValidator('query', searchQuerySchema), async (c) => {
  const { q } = c.req.valid('query');
  const users = await searchService.searchUsers(q);
  return c.json({ users });
});

// アイテム検索
searchRouter.get('/items', zValidator('query', searchQuerySchema), async (c) => {
  const { q } = c.req.valid('query');
  const items = await searchService.searchItems(q);
  return c.json({ items });
});

// タグでアイテム検索
searchRouter.get('/items/tag/:tagId', zValidator('param', tagIdSchema), async (c) => {
  const { tagId } = c.req.valid('param');
  const items = await searchService.searchItemsByTag(tagId);
  return c.json({ items });
});

// ポスト検索
searchRouter.get('/posts', zValidator('query', searchQuerySchema), async (c) => {
  const { q } = c.req.valid('query');
  const posts = await searchService.searchPosts(q);
  return c.json({ posts });
});

// タグでポスト検索
searchRouter.get('/posts/tag/:tagId', zValidator('param', tagIdSchema), async (c) => {
  const { tagId } = c.req.valid('param');
  const posts = await searchService.searchPostsByTag(tagId);
  return c.json({ posts });
});

// タグ検索
searchRouter.get('/tags', zValidator('query', searchQuerySchema), async (c) => {
  const { q } = c.req.valid('query');
  const tags = await searchService.searchTags(q);
  return c.json({ tags });
});

// 全体検索
searchRouter.get('/all', zValidator('query', searchQuerySchema), async (c) => {
  const { q } = c.req.valid('query');
  const results = await searchService.searchEverything(q);
  return c.json(results);
});

export default searchRouter;
