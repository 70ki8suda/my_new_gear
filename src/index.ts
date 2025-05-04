import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { config } from './config/env';
import authRouter from './controllers/auth.controller';
import userRouter from './controllers/user.controller';
import itemRouter from './controllers/item.controller';
import postRouter from './controllers/post.controller';
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
// 残りのルートは後で追加します

// サーバーの起動
const port = config.PORT;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
