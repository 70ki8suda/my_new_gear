import { vi } from 'vitest';

// データベースモックの作成
export const mockDb = {
  // クエリメソッド
  query: vi.fn().mockReturnThis(),

  // 一般的なDrizzleメソッド
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  execute: vi.fn(),

  // 更新メソッド
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),

  // 結合メソッド
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  rightJoin: vi.fn().mockReturnThis(),

  // トランザクション
  transaction: vi.fn(),

  // その他
  count: vi.fn().mockReturnThis(),
  countDistinct: vi.fn().mockReturnThis(),
  avg: vi.fn().mockReturnThis(),
  sum: vi.fn().mockReturnThis(),
  min: vi.fn().mockReturnThis(),
  max: vi.fn().mockReturnThis(),
};

// モックリセット用関数
export const resetMockDb = () => {
  Object.values(mockDb).forEach((method) => {
    if (typeof method === 'function' && 'mockReset' in method) {
      method.mockReset();
    }
  });

  // メソッドチェーンをリセット
  Object.entries(mockDb).forEach(([key, value]) => {
    if (typeof value === 'function' && 'mockReturnThis' in value) {
      mockDb[key] = vi.fn().mockReturnThis();
    }
  });
};
