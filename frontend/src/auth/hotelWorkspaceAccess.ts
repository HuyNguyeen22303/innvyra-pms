import type { CurrentUser } from '../types/auth.types.ts';

export const isSubscriptionPath = (pathname: string) =>
  /^\/subscription\/?$/.test(pathname);
export const isHotelWorkspaceRestricted = (user: CurrentUser | null) =>
  user?.hotel?.status === 'SUSPENDED';
export const canLoadHotelOperations = (user: CurrentUser | null) =>
  !!user && !user.mustChangePassword && !isHotelWorkspaceRestricted(user);
