import type { Principal } from '../../modules/auth/auth.types.js';
import type { PlatformPrincipal } from '../../modules/platform-auth/platform-auth.types.js';

declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
      platformPrincipal?: PlatformPrincipal;
    }
  }
}
export {};
