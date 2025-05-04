import { JwtPayload } from '../middlewares/auth.middleware';

type UserInfo = {
  id: number;
  username: string;
};

declare module 'hono' {
  interface ContextVariableMap {
    user: UserInfo;
  }
}
