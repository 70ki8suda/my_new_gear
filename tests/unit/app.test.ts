import { describe, it, expect } from 'vitest';
import { app } from '../../src/index'; // src/index.ts から app をインポート

describe('Application Instance', () => {
  it('should export a Hono application instance', () => {
    // app が存在し、null や undefined でないことを確認
    expect(app).toBeDefined();
    // Hono インスタンス特有のプロパティやメソッドがあるか確認 (例: app.request)
    expect(app).toHaveProperty('request');
    expect(typeof app.request).toBe('function');
  });
});
