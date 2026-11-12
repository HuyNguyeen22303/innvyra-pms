import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";

let handler: AxiosAdapter;
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = (config) => handler(config);
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator",
);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalChannel = globalThis.BroadcastChannel;
class FakeChannel {
  static instances: FakeChannel[] = [];
  name: string;
  messages: unknown[] = [];
  listener: ((event: { data: unknown }) => void) | null = null;
  constructor(name: string) {
    this.name = name;
    FakeChannel.instances.push(this);
  }
  addEventListener(
    _type: string,
    listener: (event: { data: unknown }) => void,
  ) {
    this.listener = listener;
  }
  postMessage(value: unknown) {
    this.messages.push(value);
  }
  emit(value: unknown) {
    this.listener?.({ data: value });
  }
}
Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
Object.defineProperty(globalThis, "BroadcastChannel", {
  value: FakeChannel,
  configurable: true,
});
const session = await import("../src/auth/hotelSession.ts");
if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
else Reflect.deleteProperty(globalThis, "window");
let queue: Promise<unknown> = Promise.resolve();
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    locks: {
      request: (_name: string, action: () => Promise<unknown>) => {
        const promise = queue.then(action);
        queue = promise.catch(() => {});
        return promise;
      },
    },
  },
});
const api = await import("../src/api/axiosClient.ts");
const { useAuthStore: store } = await import("../src/store/authStore.ts");
const cache = await import("../src/auth/hotelQueryCache.ts");
const directory = await import("../src/auth/hotelStaffCache.ts");
const platform = await import("../src/api/platformClient.ts");
const channel = FakeChannel.instances.find(
  (value) => value.name === "innvyra-hotel-session",
)!;
const profile = (id = "1", hotelId = id) => ({
  id,
  hotelId,
  username: `staff_${id}`,
  fullName: `Staff ${id}`,
  email: null,
  role: "ADMIN" as const,
  isActive: true,
  mustChangePassword: false,
});
const tokens = (id = "1", hotelId = id) => ({
  accessToken: `access-${id}-${hotelId}`,
  tokenType: "Bearer",
  expiresIn: 900,
  user: profile(id, hotelId),
});
const respond = (config: InternalAxiosRequestConfig, data: unknown = {}) => ({
  config,
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
});
const fail = (
  config: InternalAxiosRequestConfig,
  status = 401,
  code = "UNAUTHORIZED",
): never => {
  throw new AxiosError(
    "Synthetic HTTP error",
    "ERR_BAD_REQUEST",
    config,
    undefined,
    { ...respond(config, { error: { code } }), status },
  );
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
};
const tick = () => new Promise<void>((done) => setImmediate(done));
test("suspension response clears operational cache and keeps account session for the notice", async () => {
  const user = {
    ...profile(),
    hotel: {
      id: "1",
      code: "A",
      name: "Hotel A",
      timezone: "Asia/Ho_Chi_Minh",
      status: "ACTIVE" as const,
    },
  };
  session.installHotelSession("active-token", user);
  const previous = cache.hotelQueryClient();
  previous.setQueryData(["rooms"], ["private room"]);
  const before = session.hotelSessionGeneration();
  handler = async (config) => fail(config, 403, "HOTEL_SUSPENDED");
  await assert.rejects(api.apiClient.get("/rooms"));
  assert.equal(store.getState().user?.hotel?.status, "SUSPENDED");
  assert.equal(session.getAccessToken(), "active-token");
  assert.ok(session.hotelSessionGeneration() > before);
  assert.equal(previous.getQueryCache().getAll().length, 0);
  handler = async (config) => respond(config, { data: { status: "EXPIRED" } });
  const result = await api.apiClient.get("/hotel/subscription");
  assert.equal(result.data.data.status, "EXPIRED");
});
test("refreshing a reactivated hotel remounts caches and ignores prior suspension responses", async () => {
  const hotel = {
    id: "1",
    code: "A",
    name: "Hotel A",
    timezone: "Asia/Ho_Chi_Minh",
  };
  session.installHotelSession("suspended-token", {
    ...profile(),
    hotel: { ...hotel, status: "SUSPENDED" },
  });
  const old = deferred<ReturnType<typeof respond>>();
  let config!: InternalAxiosRequestConfig;
  handler = (request) => {
    config = request;
    return old.promise;
  };
  const pending = api.apiClient.get("/hotel/subscription");
  await tick();
  const before = session.hotelSessionGeneration();
  session.installHotelSession("reactivated-token", {
    ...profile(),
    hotel: { ...hotel, status: "ACTIVE" },
  });
  old.resolve(respond(config, { data: "old suspended profile" }));
  await assert.rejects(pending);
  assert.ok(session.hotelSessionGeneration() > before);
  assert.equal(store.getState().user?.hotel?.status, "ACTIVE");
});
async function login(id = "1", hotelId = id) {
  handler = async (config) => respond(config, { data: tokens(id, hotelId) });
  await store
    .getState()
    .login({ username: `staff_${id}`, password: "Synthetic varied password!" });
}
beforeEach(() => {
  session.clearHotelSession();
  store.setState({
    isLoading: false,
    isSubmitting: false,
    error: null,
    restoreError: null,
  });
  channel.messages = [];
  handler = async (config) => {
    throw new Error(`Unexpected request ${config.url}`);
  };
});
after(() => {
  session.clearHotelSession();
  axios.defaults.adapter = originalAdapter;
  Object.defineProperty(globalThis, "BroadcastChannel", {
    value: originalChannel,
    configurable: true,
  });
  if (originalNavigator)
    Object.defineProperty(globalThis, "navigator", originalNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
});

test("login A → logout → login B destroys old query/mutation caches and staff registry", async () => {
  await login();
  const old = cache.hotelQueryClient();
  old.setQueryData(["rooms"], ["Hotel A room"]);
  old
    .getMutationCache()
    .build(old, { mutationKey: ["old-form"], mutationFn: async () => "A" });
  directory.registerHotelStaff(
    [
      {
        id: "9",
        fullName: "Private A staff",
        roleTitle: "Admin",
        roleCode: "ADMIN",
        color: "green",
      },
    ],
    session.hotelSessionGeneration(),
  );
  handler = async (config) => respond(config);
  await store.getState().logout();
  assert.equal(old.getQueryCache().getAll().length, 0);
  assert.equal(old.getMutationCache().getAll().length, 0);
  assert.equal(directory.getRegisteredHotelStaff("9"), undefined);
  await login("2");
  assert.notEqual(cache.hotelQueryClient(), old);
  assert.equal(cache.hotelQueryClient().getQueryData(["rooms"]), undefined);
  cache.hotelQueryClient().setQueryData(["rooms"], ["Hotel B room"]);
  assert.deepEqual(cache.hotelQueryClient().getQueryData(["rooms"]), [
    "Hotel B room",
  ]);
});

test("relogin with the same account still gets a new cache/session scope", async () => {
  await login();
  const old = cache.hotelQueryClient();
  old.setQueryData(["guests"], ["A"]);
  await login();
  assert.notEqual(cache.hotelQueryClient(), old);
  assert.equal(cache.hotelQueryClient().getQueryData(["guests"]), undefined);
});

test("a cancelled A query that ignores AbortSignal cannot populate B cache", async () => {
  await login();
  const old = cache.hotelQueryClient();
  const gate = deferred<string>();
  const pending = old.fetchQuery({
    queryKey: ["guests"],
    queryFn: () => gate.promise,
  });
  const rejected = assert.rejects(pending);
  await login("2");
  gate.resolve("Private A guests");
  await rejected;
  await tick();
  assert.equal(old.getQueryData(["guests"]), undefined);
  assert.equal(cache.hotelQueryClient().getQueryData(["guests"]), undefined);
});

test("late directory registration from an old component is ignored after switching hotels", async () => {
  await login();
  const generation = session.hotelSessionGeneration();
  await login("2");
  directory.registerHotelStaff(
    [
      {
        id: "7",
        fullName: "Old A name",
        roleTitle: "Admin",
        roleCode: "ADMIN",
        color: "green",
      },
    ],
    generation,
  );
  assert.equal(directory.getRegisteredHotelStaff("7"), undefined);
});

test("a late successful API read cannot reach component callbacks in the new identity", async () => {
  await login();
  const gate = deferred<void>();
  handler = async (config) => {
    await gate.promise;
    return respond(config, { private: "A" });
  };
  let displayed = false;
  const pending = api.apiClient.get("/guests").then(() => {
    displayed = true;
  });
  const rejected = assert.rejects(pending, (error) => axios.isCancel(error));
  await tick();
  await login("2");
  gate.resolve();
  await rejected;
  assert.equal(displayed, false);
  assert.equal(store.getState().user?.id, "2");
});

test("a late unauthorized A response does not clear B or trigger refresh under B", async () => {
  await login();
  const gate = deferred<void>();
  handler = async (config) => {
    await gate.promise;
    return fail(config);
  };
  const pending = api.apiClient.get("/rooms");
  const rejected = assert.rejects(pending, (error) => axios.isCancel(error));
  await tick();
  await login("2");
  let requests = 0;
  handler = async (config) => {
    requests++;
    return respond(config);
  };
  gate.resolve();
  await rejected;
  assert.equal(requests, 0);
  assert.equal(store.getState().user?.id, "2");
});

test("StrictMode simultaneous restoration shares one refresh", async () => {
  const gate = deferred<void>();
  let requests = 0;
  handler = async (config) => {
    requests++;
    await gate.promise;
    return respond(config, { data: tokens() });
  };
  const a = store.getState().checkAuth();
  const b = store.getState().checkAuth();
  await tick();
  assert.equal(requests, 1);
  gate.resolve();
  await Promise.all([a, b]);
  assert.equal(store.getState().user?.id, "1");
  assert.equal(store.getState().isLoading, false);
});

test("a late refresh cannot restore a session cleared during the request", async () => {
  const gate = deferred<void>();
  handler = async (config) => {
    await gate.promise;
    return respond(config, { data: tokens() });
  };
  const checking = store.getState().checkAuth();
  await tick();
  session.clearHotelSession();
  gate.resolve();
  await checking;
  assert.equal(store.getState().user, null);
  assert.equal(api.getAccessToken(), null);
});

test("new generation restoration does not reuse a pending old refresh", async () => {
  const gate = deferred<void>();
  let calls = 0;
  handler = async (config) => {
    const id = String(++calls);
    if (id === "1") await gate.promise;
    return respond(config, { data: tokens(id) });
  };
  const a = store.getState().checkAuth();
  await tick();
  session.clearHotelSession();
  const b = store.getState().checkAuth();
  gate.resolve();
  await Promise.all([a, b]);
  assert.equal(calls, 2);
  assert.equal(store.getState().user?.id, "2");
});

test("a late login is cancelled rather than navigating as the previous user", async () => {
  const gate = deferred<void>();
  handler = async (config) => {
    await gate.promise;
    return respond(config, { data: tokens() });
  };
  const pending = store
    .getState()
    .login({ username: "staff_1", password: "test" });
  const rejected = assert.rejects(pending, (error) => axios.isCancel(error));
  await tick();
  session.clearHotelSession();
  gate.resolve();
  await rejected;
  assert.equal(store.getState().isAuthenticated, false);
});

test("parallel 401 requests share refresh and retry with current access token", async () => {
  await login();
  let refreshes = 0;
  handler = async (config) => {
    if (config.url === "/auth/refresh") {
      refreshes++;
      return respond(config, { data: { ...tokens(), accessToken: "renewed" } });
    }
    if (config.headers.Authorization !== "Bearer renewed") return fail(config);
    return respond(config);
  };
  await Promise.all([
    api.apiClient.get("/rooms"),
    api.apiClient.get("/guests"),
  ]);
  assert.equal(refreshes, 1);
});

test("identity switch on refresh never retries a write belonging to the old hotel", async () => {
  await login();
  let writes = 0;
  handler = async (config) => {
    if (config.url === "/auth/refresh")
      return respond(config, { data: tokens("2") });
    writes++;
    return fail(config);
  };
  await assert.rejects(
    api.apiClient.patch("/rooms/9", { name: "A only" }),
    (error) => axios.isCancel(error),
  );
  assert.equal(writes, 1);
  assert.equal(store.getState().user?.hotelId, "2");
});

test("role and must-change flags changing on refresh also invalidate cached permissions/data", async () => {
  await login();
  const old = cache.hotelQueryClient();
  old.setQueryData(["reports"], ["private"]);
  handler = async (config) =>
    respond(config, {
      data: { ...tokens(), user: { ...profile(), mustChangePassword: true } },
    });
  await api.refreshHotelSession();
  assert.notEqual(cache.hotelQueryClient(), old);
  assert.equal(old.getQueryCache().getAll().length, 0);
  assert.equal(store.getState().user?.mustChangePassword, true);
});

test("network restoration errors preserve identity, show retry and recover", async () => {
  await login();
  handler = async (config) => {
    throw new AxiosError("offline", "ERR_NETWORK", config);
  };
  await store.getState().checkAuth();
  assert.equal(store.getState().user?.id, "1");
  assert.ok(store.getState().restoreError);
  handler = async (config) => respond(config, { data: tokens() });
  await store.getState().checkAuth();
  assert.equal(store.getState().restoreError, null);
});

test("invalid refresh clears credentials and cached hotel data", async () => {
  await login();
  const old = cache.hotelQueryClient();
  old.setQueryData(["rooms"], ["A"]);
  handler = async (config) => fail(config);
  await store.getState().checkAuth();
  assert.equal(api.getAccessToken(), null);
  assert.equal(store.getState().user, null);
  assert.equal(old.getQueryCache().getAll().length, 0);
});

test("logout failure retains identity for a visible retry, without retaining private cache", async () => {
  await login();
  const old = cache.hotelQueryClient();
  old.setQueryData(["guests"], ["A"]);
  handler = async (config) => {
    throw new AxiosError("offline", "ERR_NETWORK", config);
  };
  await assert.rejects(store.getState().logout());
  assert.equal(store.getState().user?.id, "1");
  assert.equal(store.getState().isLoading, false);
  assert.equal(old.getQueryCache().getAll().length, 0);
  assert.ok(store.getState().error);
});

test("expired access logs out without nesting Web Locks and broadcasts no secrets", async () => {
  await login();
  let logouts = 0;
  handler = async (config) => {
    if (config.url === "/auth/refresh")
      return respond(config, { data: tokens() });
    if (++logouts === 1) return fail(config);
    return respond(config);
  };
  await store.getState().logout();
  assert.equal(logouts, 2);
  assert.equal(store.getState().user, null);
  assert.deepEqual(channel.messages, ["session-changed", "session-changed"]);
});

test("current-password error preserves session; success clears all local state and cache", async () => {
  await login();
  handler = async (config) => fail(config, 400, "INVALID_CURRENT_PASSWORD");
  await assert.rejects(
    store
      .getState()
      .changePassword({ currentPassword: "wrong", newPassword: "new" }),
  );
  assert.equal(store.getState().user?.id, "1");
  const old = cache.hotelQueryClient();
  old.setQueryData(["rooms"], ["A"]);
  handler = async (config) => respond(config);
  await store
    .getState()
    .changePassword({ currentPassword: "old", newPassword: "new" });
  assert.equal(store.getState().user, null);
  assert.equal(old.getQueryCache().getAll().length, 0);
});

test("expired password-change never retries under a different restored account", async () => {
  await login();
  let changes = 0;
  handler = async (config) => {
    if (config.url === "/auth/refresh")
      return respond(config, { data: tokens("2") });
    changes++;
    return fail(config);
  };
  await assert.rejects(
    store
      .getState()
      .changePassword({ currentPassword: "old", newPassword: "new" }),
    (error) => axios.isCancel(error),
  );
  assert.equal(changes, 1);
  assert.equal(store.getState().user?.id, "2");
});

test("403 password-change requirement updates the current profile and clears cached operations", async () => {
  await login();
  const old = cache.hotelQueryClient();
  old.setQueryData(["rooms"], ["A"]);
  handler = async (config) => fail(config, 403, "PASSWORD_CHANGE_REQUIRED");
  await assert.rejects(api.apiClient.get("/rooms"));
  assert.equal(store.getState().user?.mustChangePassword, true);
  assert.equal(old.getQueryCache().getAll().length, 0);
});

test("a sign-in/out signal from another tab clears hotel state but leaves platform credentials intact", async () => {
  await login();
  platform.setPlatformAccessToken("synthetic-platform-token", "1");
  const old = cache.hotelQueryClient();
  old.setQueryData(["rooms"], ["A"]);
  channel.emit("session-changed");
  assert.equal(store.getState().user, null);
  assert.equal(api.getAccessToken(), null);
  assert.equal(old.getQueryCache().getAll().length, 0);
  assert.deepEqual(platform.platformAuthorization(), {
    Authorization: "Bearer synthetic-platform-token",
  });
});

test("old components cannot send the previous token during synchronous cache-reset notification", async () => {
  await login();
  let duringReset: Promise<unknown> | undefined;
  const stop = session.onHotelSessionReset(() => {
    duringReset = assert.rejects(api.apiClient.get("/guests"), (error) =>
      axios.isCancel(error),
    );
  });
  session.installHotelSession("B-token", profile("2"));
  stop();
  await duringReset;
  assert.equal(store.getState().user?.id, "2");
});

test("a late logout cannot navigate or clear the newly signed-in hotel account", async () => {
  await login();
  const gate = deferred<void>();
  handler = async (config) => {
    await gate.promise;
    return respond(config);
  };
  let navigated = false;
  const pending = store
    .getState()
    .logout()
    .then(() => {
      navigated = true;
    });
  const rejected = assert.rejects(pending, (error) => axios.isCancel(error));
  await tick();
  const next = login("2");
  gate.resolve();
  await rejected;
  await next;
  assert.equal(navigated, false);
  assert.equal(store.getState().user?.id, "2");
});
