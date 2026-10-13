import type { Principal } from '../../modules/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
export {};
