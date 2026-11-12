import type { CurrentUser } from "../types/auth.types.ts";

let generation = 0;
let accessToken: string | null = null;
let user: CurrentUser | null = null;
const resetListeners = new Set<() => void>();
let observer: (value: CurrentUser | null) => void = () => {};
const channel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("innvyra-hotel-session")
    : null;
export const hotelSessionGeneration = () => generation;
export const hotelSessionUser = () => user;
export const getAccessToken = () => accessToken;
export const hotelIdentity = (value: CurrentUser) =>
  `${value.hotelId}:${value.id}:${value.role}:${!!value.mustChangePassword}:${value.hotel?.status ?? "ACTIVE"}`;
export function onHotelSessionReset(listener: () => void) {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}
export function observeHotelSession(listener: typeof observer) {
  observer = listener;
}
export function invalidateHotelRequests() {
  generation += 1;
  for (const listener of resetListeners) listener();
}
export function clearHotelSession(broadcast = false) {
  accessToken = null;
  user = null;
  invalidateHotelRequests();
  observer(null);
  if (broadcast) announceHotelSessionChange();
}
export function installHotelSession(token: string, profile: CurrentUser) {
  if (user && hotelIdentity(user) !== hotelIdentity(profile)) {
    // A reset listener may synchronously render old components. They must not
    // dispatch requests with the old token stamped as the new generation.
    accessToken = null;
    user = null;
    invalidateHotelRequests();
  }
  accessToken = token;
  user = profile;
  observer(profile);
}
export function updateHotelPasswordRequirement() {
  if (user && !user.mustChangePassword && accessToken)
    installHotelSession(accessToken, { ...user, mustChangePassword: true });
}
export function announceHotelSessionChange() {
  channel?.postMessage("session-changed");
}
channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.data === "session-changed") clearHotelSession();
});
export async function hotelAuthLock<T>(action: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("innvyra-hotel-auth", action);
  return action();
}

export function updateHotelSuspension() {
  if (user?.hotel && user.hotel.status !== 'SUSPENDED' && accessToken)
    installHotelSession(accessToken, { ...user, hotel: { ...user.hotel, status: 'SUSPENDED' } });
}
