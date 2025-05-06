import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createComment, getPostComments, deleteComment } from '../../../src/services/comment.service';
import { HTTPException } from 'hono/http-exception';
import type { Comment, User, Post, NewComment } from '../../../src/db/schema';
import type { UserId, PostId, CommentId } from '../../../src/types/branded.d';

// Repositories をモック
vi.mock('../../../src/repositories/comment.repository', () => ({
  commentRepository: {
    createComment: vi.fn(),
    findCommentsByPostId: vi.fn(),
    findCommentById: vi.fn(),
    deleteComment: vi.fn(),
  },
}));
vi.mock('../../../src/repositories/user.repository', () => ({
  userRepository: {
    findUserById: vi.fn(), // createComment で使用
    findUsersByIds: vi.fn(), // getPostComments で使用
    // findUserByEmail: vi.fn(), // 不要になった
    // findUserByUsername: vi.fn(),
    // createUser: vi.fn(),
  },
}));
vi.mock('../../../src/repositories/post.repository', () => ({
  // PostRepository のモックを追加
  postRepository: {
    findPostById: vi.fn(), // 投稿存在確認で使用
  },
}));

// 古い DB モックは削除
// const mockDb = { ... };
// vi.mock('../../../src/db', ...);

describe('Comment Service', () => {
  let mockCommentRepository: any;
  let mockUserRepository: any;
  let mockPostRepository: any; // PostRepository のモック変数を追加

  beforeEach(async () => {
    // モックされたリポジトリを取得
    const commentRepoModule = await import('../../../src/repositories/comment.repository');
    mockCommentRepository = vi.mocked(commentRepoModule.commentRepository);
    const userRepoModule = await import('../../../src/repositories/user.repository');
    mockUserRepository = vi.mocked(userRepoModule.userRepository);
    const postRepoModule = await import('../../../src/repositories/post.repository'); // 追加
    mockPostRepository = vi.mocked(postRepoModule.postRepository); // 追加

    // モックをリセット
    vi.clearAllMocks();
    // 古いDBモックのクリア処理は削除
    // mockDb.select.mockClear();
    // mockDb.from.mockClear();
    // mockDb.where.mockClear();
    // mockDb.limit.mockClear();
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
      mockPostRepository.findPostById.mockResolvedValue({ id: postId }); // 投稿は存在する (型を緩くする)
      mockCommentRepository.createComment.mockResolvedValue(createdDbComment);
      mockUserRepository.findUserById.mockResolvedValue(mockAuthor as User); // 投稿者情報取得成功

      // Act
      const result = await createComment(userId, postId, input);

      // Assert
      expect(mockPostRepository.findPostById).toHaveBeenCalledTimes(1); // 投稿存在確認
      expect(mockCommentRepository.createComment).toHaveBeenCalledWith(expect.objectContaining(newComment));
      expect(mockUserRepository.findUserById).toHaveBeenCalledWith(userId);
      expect(result.id).toBe(createdDbComment.id);
      expect(result.content).toBe(createdDbComment.content);
      expect(result.author?.id).toBe(mockAuthor.id);
      expect(result.author?.username).toBe(mockAuthor.username);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should throw 404 if post does not exist', async () => {
      // Arrange
      mockPostRepository.findPostById.mockResolvedValue(null); // 投稿が存在しない

      // Act & Assert
      await expect(createComment(userId, postId, input)).rejects.toThrow(HTTPException);
      await expect(createComment(userId, postId, input)).rejects.toHaveProperty('status', 404);
      expect(mockCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should handle error during comment creation', async () => {
      // Arrange
      mockPostRepository.findPostById.mockResolvedValue({ id: postId } as unknown as Post); // 型アサーション修正
      const dbError = new Error('Comment DB Error');
      mockCommentRepository.createComment.mockRejectedValue(dbError);

      // Act & Assert
      await expect(createComment(userId, postId, input)).rejects.toThrow(dbError);
    });

    it('should handle error when fetching author fails', async () => {
      // Arrange
      mockPostRepository.findPostById.mockResolvedValue({ id: postId } as unknown as Post); // 型アサーション修正
      mockCommentRepository.createComment.mockResolvedValue(createdDbComment);
      const authorError = new Error('Author Fetch Error');
      mockUserRepository.findUserById.mockRejectedValue(authorError);

      // Act & Assert
      await expect(createComment(userId, postId, input)).rejects.toThrow(authorError);
    });

    it('should throw 500 if created comment parsing fails', async () => {
      // Arrange
      mockPostRepository.findPostById.mockResolvedValue({ id: postId } as unknown as Post);
      // createdAt を不正な値 (null) にして返すようにモックを設定
      const invalidCreatedDbComment = { ...createdDbComment, createdAt: null };
      mockCommentRepository.createComment.mockResolvedValue(invalidCreatedDbComment as Comment); // 型アサーションで強制
      mockUserRepository.findUserById.mockResolvedValue(mockAuthor as User);

      // Act & Assert
      await expect(createComment(userId, postId, input)).rejects.toThrow(HTTPException);
      // 2回呼び出すのは冗長なので1回に修正
      const error = await createComment(userId, postId, input).catch((e) => e);
      expect(error).toBeInstanceOf(HTTPException);
      expect(error.status).toBe(500);

      expect(mockCommentRepository.createComment).toHaveBeenCalledTimes(2); // 2回呼ばれることを期待 (上の expect と合わせて)
      expect(mockUserRepository.findUserById).toHaveBeenCalledTimes(2); // 同上
    });
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
      mockPostRepository.findPostById.mockResolvedValue({ id: postId } as unknown as Post); // 型アサーション修正
      mockCommentRepository.findCommentsByPostId.mockResolvedValue([mockComment1, mockComment2]);
      mockUserRepository.findUsersByIds.mockResolvedValue([mockAuthor1, mockAuthor2] as User[]);

      // Act
      const results = await getPostComments(postId);

      // Assert
      expect(mockPostRepository.findPostById).toHaveBeenCalledTimes(1);
      expect(mockCommentRepository.findCommentsByPostId).toHaveBeenCalledWith(postId);
      expect(mockUserRepository.findUsersByIds).toHaveBeenCalledWith([mockComment1.authorId, mockComment2.authorId]);
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
      mockPostRepository.findPostById.mockResolvedValue({ id: postId } as unknown as Post); // 型アサーション修正
      mockCommentRepository.findCommentsByPostId.mockResolvedValue([]);

      // Act
      const results = await getPostComments(postId);

      // Assert
      expect(results).toEqual([]);
      expect(mockUserRepository.findUsersByIds).not.toHaveBeenCalled(); // ユーザー取得は呼ばれない
    });

    it('should throw 404 if post does not exist', async () => {
      // Arrange
      mockPostRepository.findPostById.mockResolvedValue(null); // 投稿が存在しない

      // Act & Assert
      await expect(getPostComments(postId)).rejects.toThrow(HTTPException);
      await expect(getPostComments(postId)).rejects.toHaveProperty('status', 404);
      expect(mockCommentRepository.findCommentsByPostId).not.toHaveBeenCalled();
    });

    it('should propagate error if author fetch fails', async () => {
      // Arrange
      mockPostRepository.findPostById.mockResolvedValue({ id: postId } as unknown as Post); // 投稿は存在する
      mockCommentRepository.findCommentsByPostId.mockResolvedValue([mockComment1]); // コメントは存在する
      const dbError = new Error('Author Fetch DB Error');
      mockUserRepository.findUsersByIds.mockRejectedValue(dbError); // ユーザー取得でエラー発生

      // Act & Assert
      await expect(getPostComments(postId)).rejects.toThrow(dbError);
      expect(mockCommentRepository.findCommentsByPostId).toHaveBeenCalledWith(postId); // コメント取得は呼ばれる
      expect(mockUserRepository.findUsersByIds).toHaveBeenCalledWith([mockComment1.authorId]); // ユーザー取得も呼ばれる
    });

    it('should throw 500 if comment parsing fails', async () => {
      // Arrange
      mockPostRepository.findPostById.mockResolvedValue({ id: postId } as unknown as Post);
      // createdAt が null の不正なコメントデータを返すように設定
      const invalidComment = { ...mockComment1, createdAt: null };
      mockCommentRepository.findCommentsByPostId.mockResolvedValue([invalidComment as unknown as Comment]); // 型アサーションで強制
      // 著者情報は正常に取得できるとする
      mockUserRepository.findUsersByIds.mockResolvedValue([mockAuthor1 as User]);

      // Act & Assert
      // parse でエラーになるため、HTTPException(500) がスローされるはず
      await expect(getPostComments(postId)).rejects.toThrow(HTTPException);
      // 念のためステータスコードも確認 (catch を使う形に統一)
      const error = await getPostComments(postId).catch((e) => e);
      expect(error).toBeInstanceOf(HTTPException);
      expect(error.status).toBe(500);

      // 各リポジトリが1回ずつ呼ばれることを確認 (catch の呼び出しと合わせて2回)
      // Note: 1回目と2回目の呼び出しで期待する呼び出し回数を明示
      expect(mockCommentRepository.findCommentsByPostId).toHaveBeenCalledTimes(2);
      expect(mockUserRepository.findUsersByIds).toHaveBeenCalledTimes(2);
    });
  });

  // --- deleteComment Tests ---
  describe('deleteComment', () => {
    const commentId = 301 as CommentId;
    const ownerUserId = 1 as UserId;
    const otherUserId = 2 as UserId;
    const mockComment: Comment = {
      id: commentId,
      postId: 101 as PostId,
      authorId: ownerUserId, // このコメントの所有者は ownerUserId
      content: 'Delete me',
      createdAt: new Date(),
    };

    it('should allow owner to delete their comment', async () => {
      // Arrange
      mockCommentRepository.findCommentById.mockResolvedValue(mockComment); // コメントは見つかる
      mockCommentRepository.deleteComment.mockResolvedValue(true); // 削除成功

      // Act
      await deleteComment(commentId, ownerUserId);

      // Assert
      expect(mockCommentRepository.findCommentById).toHaveBeenCalledWith(commentId);
      expect(mockCommentRepository.deleteComment).toHaveBeenCalledWith(commentId, ownerUserId);
    });

    it('should throw 404 if comment not found', async () => {
      // Arrange
      mockCommentRepository.findCommentById.mockResolvedValue(null); // コメントが見つからない

      // Act & Assert
      await expect(deleteComment(commentId, ownerUserId)).rejects.toThrow(HTTPException);
      // 2回呼び出しを避けるため catch を使用
      const error = await deleteComment(commentId, ownerUserId).catch((e) => e);
      expect(error).toBeInstanceOf(HTTPException);
      expect(error.status).toBe(404);
      expect(mockCommentRepository.deleteComment).not.toHaveBeenCalled(); // delete は呼ばれない
      // 呼び出し回数をリセット (前の expect で呼ばれるため)
      mockCommentRepository.findCommentById.mockClear();
    });

    it('should throw 403 if user is not the owner', async () => {
      // Arrange
      mockCommentRepository.findCommentById.mockResolvedValue(mockComment); // コメントは見つかる

      // Act & Assert
      // otherUserId で削除しようとする
      await expect(deleteComment(commentId, otherUserId)).rejects.toThrow(HTTPException);
      // 2回呼び出しを避けるため catch を使用
      const error = await deleteComment(commentId, otherUserId).catch((e) => e);
      expect(error).toBeInstanceOf(HTTPException);
      expect(error.status).toBe(403);
      expect(mockCommentRepository.deleteComment).not.toHaveBeenCalled(); // delete は呼ばれない
      // 呼び出し回数をリセット (前の expect で呼ばれるため)
      mockCommentRepository.findCommentById.mockClear();
    });

    it('should throw 500 if repository deletion fails', async () => {
      // Arrange
      mockCommentRepository.findCommentById.mockResolvedValue(mockComment); // コメントは見つかる
      mockCommentRepository.deleteComment.mockResolvedValue(false); // 削除失敗

      // Act & Assert
      await expect(deleteComment(commentId, ownerUserId)).rejects.toThrow(HTTPException);
      // 2回呼び出しを避けるため catch を使用
      const error = await deleteComment(commentId, ownerUserId).catch((e) => e);
      expect(error).toBeInstanceOf(HTTPException);
      expect(error.status).toBe(500);
      expect(mockCommentRepository.deleteComment).toHaveBeenCalledWith(commentId, ownerUserId);
      // 呼び出し回数をリセット (前の expect で呼ばれるため)
      mockCommentRepository.findCommentById.mockClear();
      mockCommentRepository.deleteComment.mockClear();
    });
  });
});
