import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signupUser, loginUser } from '../../../src/services/auth.service';
import { HTTPException } from 'hono/http-exception';
import type { User } from '../../../src/db/schema';
import jwt from 'jsonwebtoken';

// UserRepository モック (ファクトリ内で定義)
// const mockUserRepository = { ... }; // 削除
vi.mock('../../../src/repositories/user.repository', () => ({
  userRepository: {
    // ファクトリ内で直接定義
    findUserByEmail: vi.fn<(email: string) => Promise<User | null>>(),
    findUserByUsername: vi.fn<(username: string) => Promise<User | null>>(),
    createUser: vi.fn<(newUser: any) => Promise<User>>(),
  },
}));

// bcryptjs モック (ファクトリ内で定義 - 変更なし)
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn<(password: string, salt: string | number) => Promise<string>>(),
    compare: vi.fn<(password: string, hash: string) => Promise<boolean>>(),
  },
}));

// jsonwebtoken モック (ファクトリ内で定義 - 変更なし)
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn<(payload: object, secret: string, options?: jwt.SignOptions) => string>(),
  },
}));

// 環境変数モック (ファクトリ内で定義)
vi.mock('../../../src/config/env', () => ({
  config: {
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '1h',
  },
}));

describe('Auth Service', () => {
  beforeEach(async () => {
    // async のまま
    vi.clearAllMocks();
    // 動的インポートするモックのリセットは beforeEach で行うのが安全
    const repoModule = await import('../../../src/repositories/user.repository');
    vi.mocked(repoModule.userRepository.findUserByEmail).mockReset();
    vi.mocked(repoModule.userRepository.findUserByUsername).mockReset();
    vi.mocked(repoModule.userRepository.createUser).mockReset();

    const bcrypt = vi.mocked((await import('bcryptjs')).default);
    bcrypt.hash.mockReset();
    bcrypt.compare.mockReset();

    const jwt = vi.mocked((await import('jsonwebtoken')).default);
    jwt.sign.mockReset();
  });

  describe('signupUser', () => {
    it('should create a new user successfully', async () => {
      // Arrange
      const input = { username: 'testuser', email: 'test@example.com', password: 'Password123!' };
      const hashedPassword = 'hashedPassword123';
      const createdUser: User = {
        id: 1,
        username: input.username,
        email: input.email,
        passwordHash: hashedPassword,
        bio: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: null,
      };

      // UserRepository モック設定 (動的インポート経由)
      const repoModule = await import('../../../src/repositories/user.repository');
      vi.mocked(repoModule.userRepository.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repoModule.userRepository.findUserByUsername).mockResolvedValue(null);
      vi.mocked(repoModule.userRepository.createUser).mockResolvedValue(createdUser);

      // bcrypt モック設定 (動的インポート経由)
      const bcrypt = vi.mocked((await import('bcryptjs')).default);
      // @ts-expect-error
      bcrypt.hash.mockResolvedValue(hashedPassword);

      // Act
      const result = await signupUser(input);

      // Assert
      expect(vi.mocked(repoModule.userRepository.findUserByEmail)).toHaveBeenCalledWith(input.email);
      expect(vi.mocked(repoModule.userRepository.findUserByUsername)).toHaveBeenCalledWith(input.username);
      expect(bcrypt.hash).toHaveBeenCalledWith(input.password, 10);
      expect(vi.mocked(repoModule.userRepository.createUser)).toHaveBeenCalledWith(
        expect.objectContaining({
          username: input.username,
          email: input.email,
          passwordHash: hashedPassword,
        })
      );
      expect(result.id).toBe(createdUser.id);
      expect(result.username).toBe(createdUser.username);
      expect(result.email).toBe(createdUser.email);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should throw error if email already exists', async () => {
      const input = { username: 'newuser', email: 'test@example.com', password: 'password' };
      const existingUser: User = {
        id: 1,
        email: input.email,
        username: 'olduser',
        passwordHash: 'hash',
        bio: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: null,
      };
      const repoModule = await import('../../../src/repositories/user.repository');
      vi.mocked(repoModule.userRepository.findUserByEmail).mockResolvedValue(existingUser);
      const bcrypt = vi.mocked((await import('bcryptjs')).default);

      await expect(signupUser(input)).rejects.toThrow(HTTPException);
      await expect(signupUser(input)).rejects.toHaveProperty('status', 409);
      expect(vi.mocked(repoModule.userRepository.findUserByUsername)).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(vi.mocked(repoModule.userRepository.createUser)).not.toHaveBeenCalled();
    });

    it('should throw error if username already exists', async () => {
      const input = { username: 'testuser', email: 'new@example.com', password: 'password' };
      const existingUser: User = {
        id: 2,
        email: 'other@example.com',
        username: input.username,
        passwordHash: 'hash',
        bio: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: null,
      };
      const repoModule = await import('../../../src/repositories/user.repository');
      vi.mocked(repoModule.userRepository.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repoModule.userRepository.findUserByUsername).mockResolvedValue(existingUser);
      const bcrypt = vi.mocked((await import('bcryptjs')).default);

      await expect(signupUser(input)).rejects.toThrow(HTTPException);
      await expect(signupUser(input)).rejects.toHaveProperty('status', 409);
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(vi.mocked(repoModule.userRepository.createUser)).not.toHaveBeenCalled();
    });
  });

  describe('loginUser', () => {
    it('should login user and return JWT successfully', async () => {
      // Arrange
      const input = { email: 'test@example.com', password: 'Password123!' };
      const storedUser: User = {
        id: 1,
        username: 'testuser',
        email: input.email,
        passwordHash: 'hashedPassword123',
        bio: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: null,
      };
      const token = 'mockJwtToken';

      const repoModule = await import('../../../src/repositories/user.repository');
      vi.mocked(repoModule.userRepository.findUserByEmail).mockResolvedValue(storedUser);

      const bcrypt = vi.mocked((await import('bcryptjs')).default);
      // @ts-expect-error
      bcrypt.compare.mockResolvedValue(true);

      const jwt = vi.mocked((await import('jsonwebtoken')).default);
      // @ts-expect-error
      jwt.sign.mockReturnValue(token);

      // Act
      const result = await loginUser(input);

      // Assert
      expect(vi.mocked(repoModule.userRepository.findUserByEmail)).toHaveBeenCalledWith(input.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(input.password, storedUser.passwordHash);
      expect(jwt.sign).toHaveBeenCalledWith({ userId: storedUser.id, username: storedUser.username }, 'test-secret', {
        expiresIn: '1h',
      });
      expect(result).toBe(token);
    });

    it('should throw error if user not found', async () => {
      const input = { email: 'notfound@example.com', password: 'password' };
      const repoModule = await import('../../../src/repositories/user.repository');
      vi.mocked(repoModule.userRepository.findUserByEmail).mockResolvedValue(null);
      const bcrypt = vi.mocked((await import('bcryptjs')).default);
      const jwt = vi.mocked((await import('jsonwebtoken')).default);

      await expect(loginUser(input)).rejects.toThrow(HTTPException);
      await expect(loginUser(input)).rejects.toHaveProperty('status', 401);
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('should throw error for incorrect password', async () => {
      const input = { email: 'test@example.com', password: 'wrongPassword' };
      const storedUser: User = {
        id: 1,
        email: input.email,
        username: 'testuser',
        passwordHash: 'correctHash',
        bio: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: null,
      };
      const repoModule = await import('../../../src/repositories/user.repository');
      vi.mocked(repoModule.userRepository.findUserByEmail).mockResolvedValue(storedUser);
      const bcrypt = vi.mocked((await import('bcryptjs')).default);
      // @ts-expect-error
      bcrypt.compare.mockResolvedValue(false);
      const jwt = vi.mocked((await import('jsonwebtoken')).default);

      await expect(loginUser(input)).rejects.toThrow(HTTPException);
      await expect(loginUser(input)).rejects.toHaveProperty('status', 401);
      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });
});
