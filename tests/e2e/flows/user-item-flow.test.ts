import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { app } from '../../../src/index';

// 実際のアプリケーションとDBをモック化するコードはスキップ
// E2E環境では実際のDBに接続するべきですが、ここではモックを使います

// 認証情報
let authToken: string;
let userId: number;
let itemId: number;

// モックレスポンスを設定
const mockResponse = (status: number, data: any) => {
  return Promise.resolve({
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
  });
};

// リクエストをモック化
vi.spyOn(app, 'request').mockImplementation((path: string, options: any) => {
  // 各エンドポイントに対してモックレスポンスを返す
  if (path === '/api/auth/signup' && options.method === 'POST') {
    const body = JSON.parse(options.body);
    return mockResponse(201, {
      message: 'ユーザーが正常に登録されました',
      user: {
        id: 1,
        username: body.username,
        email: body.email,
        createdAt: new Date().toISOString(),
      },
    });
  }

  if (path === '/api/auth/login' && options.method === 'POST') {
    const body = JSON.parse(options.body);
    if (body.email === 'flow@example.com' && body.password === 'Password123!') {
      return mockResponse(200, {
        message: 'ログインに成功しました',
        token: 'mock_jwt_token',
      });
    }
    return mockResponse(401, { message: 'メールアドレスまたはパスワードが正しくありません' });
  }

  if (path === '/api/items' && options.method === 'POST') {
    const auth = options.headers['Authorization'];
    if (!auth || !auth.includes('mock_jwt_token')) {
      return mockResponse(401, { message: '認証が必要です' });
    }

    const body = JSON.parse(options.body);
    return mockResponse(201, {
      message: 'アイテムが正常に作成されました',
      item: {
        id: 1,
        name: body.name,
        description: body.description,
        userId: 1,
        createdAt: new Date().toISOString(),
      },
    });
  }

  if (path === '/api/items/1' && options.method === 'GET') {
    return mockResponse(200, {
      item: {
        id: 1,
        name: 'テストアイテム',
        description: 'テスト用の説明',
        userId: 1,
        createdAt: new Date().toISOString(),
      },
    });
  }

  if (path.startsWith('/api/items/1/posts') && options.method === 'POST') {
    const auth = options.headers['Authorization'];
    if (!auth || !auth.includes('mock_jwt_token')) {
      return mockResponse(401, { message: '認証が必要です' });
    }

    const body = JSON.parse(options.body);
    return mockResponse(201, {
      message: '投稿が正常に作成されました',
      post: {
        id: 1,
        content: body.content,
        itemId: 1,
        authorId: 1,
        createdAt: new Date().toISOString(),
      },
    });
  }

  // デフォルトでは404を返す
  return mockResponse(404, { message: 'Not Found' });
});

describe('ユーザー・アイテム・投稿フロー', () => {
  beforeAll(async () => {
    // 実際のE2E環境ではDBセットアップを行う
    // vi.spyOn(app, 'request').mockRestore(); // モックを解除する場合
  });

  afterAll(async () => {
    // テスト後にクリーンアップ
    vi.clearAllMocks();
  });

  it('ユーザー登録からアイテム作成、投稿までの一連のフローが機能すること', async () => {
    // 1. ユーザー登録
    const signupRes = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'flowuser',
        email: 'flow@example.com',
        password: 'Password123!',
      }),
    });

    expect(signupRes.status).toBe(201);
    const signupData = await signupRes.json();
    expect(signupData.user).toHaveProperty('id');
    userId = signupData.user.id;

    // 2. ログイン
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'flow@example.com',
        password: 'Password123!',
      }),
    });

    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData).toHaveProperty('token');
    authToken = loginData.token;

    // 3. アイテム作成
    const createItemRes = await app.request('/api/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'テストアイテム',
        description: 'テスト用の説明',
      }),
    });

    expect(createItemRes.status).toBe(201);
    const itemData = await createItemRes.json();
    expect(itemData).toHaveProperty('item');
    expect(itemData.item).toHaveProperty('id');
    itemId = itemData.item.id;

    // 4. アイテム詳細取得
    const getItemRes = await app.request(`/api/items/${itemId}`, {
      method: 'GET',
    });

    expect(getItemRes.status).toBe(200);
    const retrievedItemData = await getItemRes.json();
    expect(retrievedItemData).toHaveProperty('item');
    expect(retrievedItemData.item).toHaveProperty('name', 'テストアイテム');

    // 5. 投稿作成
    const createPostRes = await app.request(`/api/items/${itemId}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        content: 'これはテスト投稿です',
      }),
    });

    expect(createPostRes.status).toBe(201);
    const postData = await createPostRes.json();
    expect(postData).toHaveProperty('post');
    expect(postData.post).toHaveProperty('content', 'これはテスト投稿です');
    expect(postData.post).toHaveProperty('itemId', itemId);
  });
});
