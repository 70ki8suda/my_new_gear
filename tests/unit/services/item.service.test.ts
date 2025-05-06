import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createItem, getUserItems, getItemById, updateItem, deleteItem } from '../../../src/services/item.service';
import { HTTPException } from 'hono/http-exception';
import type { Item, NewItem } from '../../../src/db/schema';
import type { UserId, ItemId } from '../../../src/types/branded.d';

// ItemRepository をモック
vi.mock('../../../src/repositories/item.repository', () => ({
  itemRepository: {
    createItem: vi.fn(),
    findItemById: vi.fn(),
    findItemsByUserId: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
  },
}));

describe('Item Service', () => {
  let mockItemRepository: any;

  beforeEach(async () => {
    // モックされたリポジトリを取得
    const repoModule = await import('../../../src/repositories/item.repository');
    mockItemRepository = vi.mocked(repoModule.itemRepository);

    // 各モックをリセット
    vi.clearAllMocks(); // これですべての vi.fn がクリアされるはず
    // mockItemRepository.createItem.mockReset();
    // mockItemRepository.findItemById.mockReset();
    // mockItemRepository.findItemsByUserId.mockReset();
    // mockItemRepository.updateItem.mockReset();
    // mockItemRepository.deleteItem.mockReset();
  });

  // --- createItem Tests ---
  describe('createItem', () => {
    it('should create a new item successfully and return parsed item', async () => {
      const userId = 1 as UserId;
      const input = { name: 'Test Item', description: 'Test Desc', defaultPhotoId: undefined };
      const newItem: NewItem = {
        userId: userId as number,
        name: input.name,
        description: input.description,
        defaultPhotoId: undefined,
      };
      const createdDbItem: Item = {
        id: 101 as ItemId,
        userId: userId as number,
        name: input.name,
        description: input.description,
        defaultPhotoId: null,
        createdAt: new Date(),
        updatedAt: null,
      };

      // Arrange: リポジトリの createItem が成功を返すように設定
      mockItemRepository.createItem.mockResolvedValue(createdDbItem);

      // Act: サービスメソッド呼び出し
      const result = await createItem(userId, input);

      // Assert: リポジトリが正しい引数で呼ばれたか
      expect(mockItemRepository.createItem).toHaveBeenCalledWith(
        expect.objectContaining(newItem) // createdAt はリポジトリ/DBで設定される想定
      );

      // Assert: 戻り値が Zod スキーマでパースされた形式か
      expect(result).toBeDefined();
      expect(result.id).toBe(createdDbItem.id);
      expect(result.name).toBe(createdDbItem.name);
      expect(result.userId).toBe(userId); // Branded Type が戻ることを期待
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should throw HTTPException if repository fails', async () => {
      const userId = 1 as UserId;
      const input = { name: 'Test Item', description: 'Test Desc', defaultPhotoId: undefined };
      const error = new Error('DB Error');

      // Arrange: リポジトリがエラーを投げるように設定
      mockItemRepository.createItem.mockRejectedValue(error);

      // Act & Assert: サービスがエラーを投げるか
      await expect(createItem(userId, input)).rejects.toThrow(error); // Repository のエラーがそのまま投げられるか、あるいは spezifische HTTP Exception かは実装による
      // もしサービスが特定のエラーを期待するなら:
      // await expect(createItem(userId, input)).rejects.toThrow(HTTPException);
      // await expect(createItem(userId, input)).rejects.toHaveProperty('status', 500);
    });

    // TODO: Zod パース失敗時のテスト (もしリポジトリが不正なデータを返す可能性がある場合)
  });

  // --- getUserItems Tests ---
  describe('getUserItems', () => {
    it.todo('should return a list of parsed items for the user');
    it.todo('should return an empty list if user has no items');
    it.todo('should handle repository errors');
    it.todo('should filter out items that fail Zod parsing');
  });

  // --- getItemById Tests ---
  describe('getItemById', () => {
    it.todo('should return a parsed item if found');
    it.todo('should throw 404 HTTPException if item not found');
    it.todo('should throw error if Zod parsing fails');
    it.todo('should handle repository errors');
  });

  // --- updateItem Tests ---
  describe('updateItem', () => {
    it.todo('should update the item and return the parsed updated item');
    it.todo('should throw 404 HTTPException if item not found or not owned by user');
    it.todo('should throw 400 HTTPException if no update data is provided');
    it.todo('should handle repository errors during update');
    it.todo('should throw error if Zod parsing fails for the updated item');
  });

  // --- deleteItem Tests ---
  describe('deleteItem', () => {
    it.todo('should return success true if deletion is successful');
    it.todo('should throw 404 HTTPException if item not found or not owned by user');
    it.todo('should handle repository errors during deletion');
  });
});
