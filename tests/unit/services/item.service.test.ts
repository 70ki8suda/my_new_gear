import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createItem, getUserItems, getItemById, updateItem, deleteItem } from '../../../src/services/item.service';
import { HTTPException } from 'hono/http-exception';
import type { Item, NewItem } from '../../../src/db/schema';
import type { UserId, ItemId, PhotoId } from '../../../src/types/branded.d';

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
    const userId = 1 as UserId;
    const mockDbItems: Item[] = [
      {
        id: 101 as ItemId,
        userId: userId as number,
        name: 'Item 1',
        description: 'Desc 1',
        defaultPhotoId: null,
        createdAt: new Date(),
        updatedAt: null,
      },
      {
        id: 102 as ItemId,
        userId: userId as number,
        name: 'Item 2',
        description: null,
        defaultPhotoId: 301 as PhotoId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    // 不正なデータ (name が null など ItemSchema に違反)
    const invalidDbItem = {
      id: 103 as ItemId,
      userId: userId as number,
      name: null,
      description: 'Invalid',
      defaultPhotoId: null,
      createdAt: new Date(),
      updatedAt: null,
    };

    it('should return a list of parsed items for the user', async () => {
      // Arrange: リポジトリがアイテムリストを返すように設定
      mockItemRepository.findItemsByUserId.mockResolvedValue(mockDbItems);

      // Act: サービスメソッド呼び出し
      const result = await getUserItems(userId);

      // Assert: リポジトリが正しい引数で呼ばれたか
      expect(mockItemRepository.findItemsByUserId).toHaveBeenCalledWith(userId);
      // Assert: 正しい数のアイテムが返されたか (パース成功)
      expect(result).toHaveLength(mockDbItems.length);
      // Assert: 各アイテムが期待される形式か (主要プロパティをチェック)
      expect(result[0].id).toBe(mockDbItems[0].id);
      expect(result[0].name).toBe(mockDbItems[0].name);
      expect(result[1].id).toBe(mockDbItems[1].id);
      expect(result[1].description).toBe(mockDbItems[1].description);
      expect(result[1].defaultPhotoId).toBe(mockDbItems[1].defaultPhotoId);
      // Branded Type が適用されているかチェック (例)
      expect(typeof result[0].id).toBe('number'); // Branded Type はランタイムでは number
      expect(typeof result[0].userId).toBe('number');
    });

    it('should return an empty list if user has no items', async () => {
      // Arrange: リポジトリが空リストを返すように設定
      mockItemRepository.findItemsByUserId.mockResolvedValue([]);

      // Act
      const result = await getUserItems(userId);

      // Assert
      expect(mockItemRepository.findItemsByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual([]);
    });

    it('should handle repository errors', async () => {
      // Arrange: リポジトリがエラーを投げるように設定
      const error = new Error('DB Error fetching items');
      mockItemRepository.findItemsByUserId.mockRejectedValue(error);

      // Act & Assert: サービスがエラーをそのまま投げることを期待
      await expect(getUserItems(userId)).rejects.toThrow(error);
    });

    it('should filter out items that fail Zod parsing', async () => {
      // Arrange: リポジトリが正常なデータと不正なデータを混ぜて返すように設定
      mockItemRepository.findItemsByUserId.mockResolvedValue([...mockDbItems, invalidDbItem]);

      // Act: サービスメソッド呼び出し
      const result = await getUserItems(userId);

      // Assert: リポジトリは呼ばれたか
      expect(mockItemRepository.findItemsByUserId).toHaveBeenCalledWith(userId);
      // Assert: 不正なデータが除外され、正常なデータのみが返されたか
      expect(result).toHaveLength(mockDbItems.length);
      expect(result.find((item) => item.id === invalidDbItem.id)).toBeUndefined();
      expect(result[0].id).toBe(mockDbItems[0].id);
      expect(result[1].id).toBe(mockDbItems[1].id);
    });
  });

  // --- getItemById Tests ---
  describe('getItemById', () => {
    const itemId = 101 as ItemId;
    const userId = 1 as UserId;
    const mockDbItem: Item = {
      id: itemId,
      userId: userId as number,
      name: 'Found Item',
      description: 'Desc',
      defaultPhotoId: null,
      createdAt: new Date(),
      updatedAt: null,
    };
    const invalidDbItem = {
      id: itemId,
      userId: userId as number,
      name: null,
      description: 'Invalid',
      defaultPhotoId: null,
      createdAt: new Date(),
      updatedAt: null,
    }; // name が null

    it('should return a parsed item if found', async () => {
      // Arrange: リポジトリがアイテムを返すように設定
      mockItemRepository.findItemById.mockResolvedValue(mockDbItem);

      // Act
      const result = await getItemById(itemId);

      // Assert
      expect(mockItemRepository.findItemById).toHaveBeenCalledWith(itemId);
      expect(result).toBeDefined();
      expect(result.id).toBe(mockDbItem.id);
      expect(result.name).toBe(mockDbItem.name);
      expect(result.userId).toBe(userId);
    });

    it('should throw 404 HTTPException if item not found', async () => {
      // Arrange: リポジトリが null (見つからない) を返すように設定
      mockItemRepository.findItemById.mockResolvedValue(null);

      // Act & Assert
      await expect(getItemById(itemId)).rejects.toThrow(HTTPException);
      await expect(getItemById(itemId)).rejects.toHaveProperty('status', 404);
      expect(mockItemRepository.findItemById).toHaveBeenCalledWith(itemId);
    });

    it('should throw 500 HTTPException if Zod parsing fails', async () => {
      // Arrange: リポジトリが不正なデータを返すように設定
      mockItemRepository.findItemById.mockResolvedValue(invalidDbItem);

      // Act & Assert
      await expect(getItemById(itemId)).rejects.toThrow(HTTPException);
      await expect(getItemById(itemId)).rejects.toHaveProperty('status', 500);
      expect(mockItemRepository.findItemById).toHaveBeenCalledWith(itemId);
    });

    it('should handle repository errors', async () => {
      // Arrange: リポジトリがエラーを投げるように設定
      const error = new Error('DB Error finding item');
      mockItemRepository.findItemById.mockRejectedValue(error);

      // Act & Assert
      await expect(getItemById(itemId)).rejects.toThrow(error);
    });
  });

  // --- updateItem Tests ---
  describe('updateItem', () => {
    const userId = 1 as UserId;
    const itemId = 101 as ItemId;
    const updateInput = { name: 'Updated Name', description: 'Updated Desc' };
    const currentDbItem: Item = {
      id: itemId,
      userId: userId as number,
      name: 'Original Name',
      description: 'Original Desc',
      defaultPhotoId: null,
      createdAt: new Date(),
      updatedAt: null,
    };
    const updatedDbItem: Item = { ...currentDbItem, ...updateInput, updatedAt: new Date() };
    const invalidUpdateDbItem = { ...updatedDbItem, name: null }; // name が null

    it('should update the item and return the parsed updated item', async () => {
      // Arrange: リポジトリが更新成功を返すように設定
      mockItemRepository.updateItem.mockResolvedValue(updatedDbItem);

      // Act
      const result = await updateItem(userId, itemId, updateInput);

      // Assert
      expect(mockItemRepository.updateItem).toHaveBeenCalledWith(itemId, expect.objectContaining(updateInput), userId);
      expect(result).toBeDefined();
      expect(result.id).toBe(itemId);
      expect(result.name).toBe(updateInput.name);
      expect(result.description).toBe(updateInput.description);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw 404 HTTPException if item not found or not owned by user', async () => {
      // Arrange: リポジトリが null (更新対象なし/失敗) を返すように設定
      mockItemRepository.updateItem.mockResolvedValue(null);

      // Act & Assert
      await expect(updateItem(userId, itemId, updateInput)).rejects.toThrow(HTTPException);
      await expect(updateItem(userId, itemId, updateInput)).rejects.toHaveProperty('status', 404);
      expect(mockItemRepository.updateItem).toHaveBeenCalledWith(itemId, expect.objectContaining(updateInput), userId);
    });

    it('should throw 400 HTTPException if no update data is provided', async () => {
      // Arrange: 空の更新データを渡す
      const emptyInput = {};

      // Act & Assert
      await expect(updateItem(userId, itemId, emptyInput)).rejects.toThrow(HTTPException);
      await expect(updateItem(userId, itemId, emptyInput)).rejects.toHaveProperty('status', 400);
      expect(mockItemRepository.updateItem).not.toHaveBeenCalled(); // リポジトリは呼ばれないはず
    });

    it('should handle repository errors during update', async () => {
      // Arrange: リポジトリがエラーを投げるように設定
      const error = new Error('DB Error updating item');
      mockItemRepository.updateItem.mockRejectedValue(error);

      // Act & Assert
      await expect(updateItem(userId, itemId, updateInput)).rejects.toThrow(error);
    });

    it('should throw 500 HTTPException if Zod parsing fails for the updated item', async () => {
      // Arrange: リポジトリが更新成功したが、不正なデータを返すように設定
      mockItemRepository.updateItem.mockResolvedValue(invalidUpdateDbItem);

      // Act & Assert
      await expect(updateItem(userId, itemId, updateInput)).rejects.toThrow(HTTPException);
      await expect(updateItem(userId, itemId, updateInput)).rejects.toHaveProperty('status', 500);
      expect(mockItemRepository.updateItem).toHaveBeenCalledWith(itemId, expect.objectContaining(updateInput), userId);
    });
  });

  // --- deleteItem Tests ---
  describe('deleteItem', () => {
    const userId = 1 as UserId;
    const itemId = 101 as ItemId;

    it('should return success true if deletion is successful', async () => {
      // Arrange: リポジトリが true (削除成功) を返すように設定
      mockItemRepository.deleteItem.mockResolvedValue(true);

      // Act
      const result = await deleteItem(userId, itemId);

      // Assert
      expect(mockItemRepository.deleteItem).toHaveBeenCalledWith(itemId, userId);
      expect(result).toEqual({ success: true });
    });

    it('should throw 404 HTTPException if item not found or not owned by user', async () => {
      // Arrange: リポジトリが false (削除対象なし/失敗) を返すように設定
      mockItemRepository.deleteItem.mockResolvedValue(false);

      // Act & Assert
      await expect(deleteItem(userId, itemId)).rejects.toThrow(HTTPException);
      await expect(deleteItem(userId, itemId)).rejects.toHaveProperty('status', 404);
      expect(mockItemRepository.deleteItem).toHaveBeenCalledWith(itemId, userId);
    });

    it('should handle repository errors during deletion', async () => {
      // Arrange: リポジトリがエラーを投げるように設定
      const error = new Error('DB Error deleting item');
      mockItemRepository.deleteItem.mockRejectedValue(error);

      // Act & Assert
      await expect(deleteItem(userId, itemId)).rejects.toThrow(error);
    });
  });
});
