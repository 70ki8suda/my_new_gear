import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { config } from './config/env';
import authRouter from './routes/auth.route';
import userRouter from './routes/user.route';
import itemRouter from './routes/item.route';
import postRouter from './routes/post.route';
import tagRouter from './routes/tag.route';
import feedRouter from './routes/feed.route';
import notificationRouter from './routes/notification.route';
import searchRouter from './routes/search.route';
// 残りのルートは後で追加します

const app = new Hono();

// ミドルウェアの設定
app.use('*', logger());
app.use('*', cors());

// ヘルスチェックエンドポイント
app.get('/', (c) => c.json({ status: 'ok', message: 'My New Gear API is running' }));

// ルートの追加
app.route('/api/auth', authRouter);
app.route('/api/users', userRouter);
app.route('/api/items', itemRouter);
app.route('/api/posts', postRouter);
app.route('/api/tags', tagRouter);
app.route('/api/feed', feedRouter);
app.route('/api/notifications', notificationRouter);
app.route('/api/search', searchRouter);
// 残りのルートは後で追加します

// サーバーの起動（テスト環境では実行しない）
const port = config.PORT;

// テスト環境でない場合のみサーバーを起動
if (process.env.NODE_ENV !== 'test') {
  console.log(`Server is running on port ${port}`);

  serve({
    fetch: app.fetch,
    port,
  });
}

// テストのためにアプリケーションをエクスポート
export { app };
