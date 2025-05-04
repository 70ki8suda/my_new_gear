import type { UserId } from './branded.d';
import { JwtPayload } from '../middlewares/auth.middleware';

type UserInfo = {
  id: UserId;
  username: string;
};

declare module 'hono' {
  interface ContextVariableMap {
    user: UserInfo;
  }
}
