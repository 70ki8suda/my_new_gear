import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createComment, getPostComments } from '../../../src/services/comment.service';
import { HTTPException } from 'hono/http-exception';
import type { Comment, User, Post, NewComment } from '../../../src/db/schema';
import type { UserId, PostId, CommentId } from '../../../src/types/branded.d';

// Repositories をモック
vi.mock('../../../src/repositories/comment.repository', () => ({
  commentRepository: {
    createComment: vi.fn(),
    findCommentsByPostId: vi.fn(),
    findCommentById: vi.fn(), // deleteComment 用なども含めておく
    deleteComment: vi.fn(),
  },
}));
vi.mock('../../../src/repositories/user.repository', () => ({
  userRepository: {
    findUserByEmail: vi.fn(), // サービスで使われている (仮)
    findUserByUsername: vi.fn(), // 他のテストで必要になるかも
    createUser: vi.fn(),
    // TODO: findUserById, findUsersByIds を追加した方が良い
  },
}));

// 一時的に残っている db アクセスもモック
// TODO: PostRepository 導入後に削除
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(),
};
vi.mock('../../../src/db', () => ({
  db: mockDb,
}));

describe('Comment Service', () => {
  let mockCommentRepository: any;
  let mockUserRepository: any;

  beforeEach(async () => {
    // モックされたリポジトリを取得
    const commentRepoModule = await import('../../../src/repositories/comment.repository');
    mockCommentRepository = vi.mocked(commentRepoModule.commentRepository);
    const userRepoModule = await import('../../../src/repositories/user.repository');
    mockUserRepository = vi.mocked(userRepoModule.userRepository);

    // モックをリセット
    vi.clearAllMocks();
    mockDb.select.mockClear(); // db モックもクリア
    mockDb.from.mockClear();
    mockDb.where.mockClear();
    mockDb.limit.mockClear();
  });

  // --- createComment Tests ---
  describe('createComment', () => {
    const userId = 1 as UserId;
    const postId = 101 as PostId;
    const input = { content: 'Test Comment' };
    const newComment: NewComment = { authorId: userId, postId, content: input.content };
    const createdDbComment: Comment = {
      id: 201 as CommentId,
      postId: postId,
      authorId: userId,
      content: input.content,
      createdAt: new Date(),
    };
    const mockAuthor: Partial<User> = { id: userId, username: 'testuser', avatarUrl: null }; // findUserByEmail の戻り値

    it('should create a comment, fetch author, and return parsed comment', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([{ id: postId }]); // 投稿は存在する (型を緩くする)
      mockCommentRepository.createComment.mockResolvedValue(createdDbComment);
      mockUserRepository.findUserByEmail.mockResolvedValue(mockAuthor as User); // 投稿者情報取得成功

      // Act
      const result = await createComment(userId, postId, input);

      // Assert
      expect(mockDb.limit).toHaveBeenCalledTimes(1); // 投稿存在確認
      expect(mockCommentRepository.createComment).toHaveBeenCalledWith(expect.objectContaining(newComment));
      expect(mockUserRepository.findUserByEmail).toHaveBeenCalledWith(userId as unknown as string); // 仮の呼び出し
      expect(result.id).toBe(createdDbComment.id);
      expect(result.content).toBe(createdDbComment.content);
      expect(result.author?.id).toBe(mockAuthor.id);
      expect(result.author?.username).toBe(mockAuthor.username);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should throw 404 if post does not exist', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]); // 投稿が存在しない

      // Act & Assert
      await expect(createComment(userId, postId, input)).rejects.toThrow(HTTPException);
      await expect(createComment(userId, postId, input)).rejects.toHaveProperty('status', 404);
      expect(mockCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should handle error during comment creation', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([{ id: postId }]);
      const dbError = new Error('Comment DB Error');
      mockCommentRepository.createComment.mockRejectedValue(dbError);

      // Act & Assert
      await expect(createComment(userId, postId, input)).rejects.toThrow(dbError);
    });

    it('should handle error when fetching author fails', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([{ id: postId }]);
      mockCommentRepository.createComment.mockResolvedValue(createdDbComment);
      const authorError = new Error('Author Fetch Error');
      mockUserRepository.findUserByEmail.mockRejectedValue(authorError);

      // Act & Assert
      await expect(createComment(userId, postId, input)).rejects.toThrow(authorError);
    });

    // TODO: Zod パース失敗時のテスト
  });

  // --- getPostComments Tests ---
  describe('getPostComments', () => {
    const postId = 101 as PostId;
    const mockComment1: Comment = {
      id: 201 as CommentId,
      postId,
      authorId: 1 as UserId,
      content: 'C1',
      createdAt: new Date(2024, 0, 1),
    };
    const mockComment2: Comment = {
      id: 202 as CommentId,
      postId,
      authorId: 2 as UserId,
      content: 'C2',
      createdAt: new Date(2024, 0, 2),
    };
    const mockAuthor1: Partial<User> = { id: 1 as UserId, username: 'user1', avatarUrl: null };
    const mockAuthor2: Partial<User> = { id: 2 as UserId, username: 'user2', avatarUrl: 'url' };

    it('should return comments with author info successfully', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([{ id: postId }]); // 投稿存在
      mockCommentRepository.findCommentsByPostId.mockResolvedValue([mockComment1, mockComment2]);
      mockUserRepository.findUserByEmail
        .mockResolvedValueOnce(mockAuthor1 as User)
        .mockResolvedValueOnce(mockAuthor2 as User);

      // Act
      const results = await getPostComments(postId);

      // Assert
      expect(mockDb.limit).toHaveBeenCalledTimes(1);
      expect(mockCommentRepository.findCommentsByPostId).toHaveBeenCalledWith(postId);
      expect(mockUserRepository.findUserByEmail).toHaveBeenCalledTimes(2);
      expect(results.length).toBe(2);
      if (results.length === 2) {
        expect(results[0].id).toBe(mockComment1.id);
        expect(results[0].author?.id).toBe(mockAuthor1.id);
        expect(results[1].id).toBe(mockComment2.id);
        expect(results[1].author?.id).toBe(mockAuthor2.id);
      }
    });

    it('should return empty array if no comments found', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([{ id: postId }]);
      mockCommentRepository.findCommentsByPostId.mockResolvedValue([]);

      // Act
      const results = await getPostComments(postId);

      // Assert
      expect(results).toEqual([]);
      expect(mockUserRepository.findUserByEmail).not.toHaveBeenCalled();
    });

    it('should throw 404 if post does not exist', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]); // 投稿が存在しない

      // Act & Assert
      await expect(getPostComments(postId)).rejects.toThrow(HTTPException);
      await expect(getPostComments(postId)).rejects.toHaveProperty('status', 404);
      expect(mockCommentRepository.findCommentsByPostId).not.toHaveBeenCalled();
    });

    // TODO: Handle repository errors during comment fetch
    // TODO: Handle repository errors during author fetch
    // TODO: Test filtering of comments that fail Zod parsing
  });

  // --- deleteComment Test (assuming a service method exists) ---
  // describe('deleteComment', () => { ... });
});
