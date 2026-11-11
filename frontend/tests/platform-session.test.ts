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
let queue: Promise<unknown> = Promise.resolve();
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    locks: {
      request: (_name: string, action: () => Promise<unknown>) => {
        const result = queue.then(action);
        queue = result.catch(() => {});
        return result;
      },
    },
  },
});
const api = await import("../src/api/platformClient.ts");
const { usePlatformAuthStore: store } =
  await import("../src/store/platformAuthStore.ts");
const profile = (id = "1") => ({
  id,
  fullName: `Platform ${id}`,
  email: `admin${id}@example.test`,
  role: "PLATFORM_ADMIN" as const,
  isActive: true,
});
const tokens = (id = "1", token = `token-${id}`) => ({
  accessToken: token,
  tokenType: "Bearer",
  expiresIn: 900,
  user: profile(id),
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
  status: number,
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
  return { promise, resolve };
};
const tick = () => new Promise<void>((done) => setImmediate(done));
async function login(id = "1") {
  handler = async (config) => respond(config, { data: tokens(id) });
  await store
    .getState()
    .login({
      email: profile(id).email,
      password: "Synthetic test passphrase!",
    });
}
beforeEach(() => {
  api.clearPlatformSession();
  store.setState({
    user: null,
    isLoading: true,
    isSubmitting: false,
    error: null,
    restoreError: null,
  });
  handler = async (config) => {
    throw new Error(`Unexpected request: ${config.url}`);
  };
});
after(() => {
  axios.defaults.adapter = originalAdapter;
  if (originalNavigator)
    Object.defineProperty(globalThis, "navigator", originalNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
});

test("coalesces simultaneous restoration into one refresh", async () => {
  const gate = deferred<void>();
  let requests = 0;
  handler = async (config) => {
    requests++;
    await gate.promise;
    return respond(config, { data: tokens() });
  };
  const first = store.getState().checkAuth();
  const second = store.getState().checkAuth();
  await tick();
  assert.equal(requests, 1);
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(store.getState().user?.id, "1");
  assert.equal(store.getState().isLoading, false);
});
test("a late refresh cannot restore a cleared session", async () => {
  const gate = deferred<void>();
  handler = async (config) => {
    await gate.promise;
    return respond(config, { data: tokens() });
  };
  const checking = store.getState().checkAuth();
  await tick();
  api.clearPlatformSession();
  gate.resolve();
  await checking;
  assert.equal(store.getState().user, null);
  assert.deepEqual(api.platformAuthorization(), {});
});
test("a new session can restore while the previous generation is still completing", async () => {
  const firstGate = deferred<void>();
  let calls = 0;
  handler = async (config) => {
    calls++;
    if (calls === 1) await firstGate.promise;
    return respond(config, { data: tokens(calls === 1 ? "1" : "2") });
  };
  const previous = store.getState().checkAuth();
  await tick();
  api.clearPlatformSession();
  const current = store.getState().checkAuth();
  firstGate.resolve();
  await Promise.all([previous, current]);
  assert.equal(calls, 2);
  assert.equal(store.getState().user?.id, "2");
});
test("concurrent unauthorized requests share one refresh and retry with its token", async () => {
  await login();
  let refreshes = 0;
  let successes = 0;
  handler = async (config) => {
    if (config.url === "/auth/refresh") {
      refreshes++;
      await tick();
      return respond(config, { data: tokens("1", "new-token") });
    }
    if (config.headers.Authorization !== "Bearer new-token") fail(config, 401);
    successes++;
    return respond(config, { data: {} });
  };
  await Promise.all([
    api.platformClient.get("/first"),
    api.platformClient.get("/second"),
  ]);
  assert.equal(refreshes, 1);
  assert.equal(successes, 2);
});
test("network failure during refresh preserves identity and allows a later retry", async () => {
  await login();
  let offline = true;
  handler = async (config) => {
    if (config.url === "/auth/refresh") {
      if (offline)
        throw new AxiosError("Synthetic offline", "ERR_NETWORK", config);
      return respond(config, { data: tokens("1", "recovered") });
    }
    if (config.headers.Authorization !== "Bearer recovered") fail(config, 401);
    return respond(config);
  };
  await assert.rejects(api.platformClient.get("/me"));
  assert.equal(store.getState().user?.id, "1");
  offline = false;
  await api.platformClient.get("/me");
  assert.equal(store.getState().user?.id, "1");
});
test("an invalid refresh clears the platform identity", async () => {
  await login();
  handler = async (config) => fail(config, 401);
  await assert.rejects(api.platformClient.get("/me"));
  assert.equal(store.getState().user, null);
  assert.deepEqual(api.platformAuthorization(), {});
});
test(
  "expired access can log out without nesting browser auth locks",
  { timeout: 5000 },
  async () => {
    await login();
    let logouts = 0;
    let refreshes = 0;
    handler = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshes++;
        return respond(config, { data: tokens("1", "fresh") });
      }
      logouts++;
      if (config.headers.Authorization !== "Bearer fresh") fail(config, 401);
      return respond(config);
    };
    await store.getState().logout();
    assert.equal(logouts, 2);
    assert.equal(refreshes, 1);
    assert.equal(store.getState().user, null);
  },
);
test("failed logout keeps the current session visible for a retry", async () => {
  await login();
  handler = async (config) => {
    throw new AxiosError("Synthetic offline", "ERR_NETWORK", config);
  };
  await assert.rejects(store.getState().logout());
  assert.equal(store.getState().user?.id, "1");
  assert.equal(store.getState().isSubmitting, false);
  handler = async (config) => respond(config);
  await store.getState().logout();
  assert.equal(store.getState().user, null);
});
test("incorrect current password preserves the session without refresh", async () => {
  await login();
  let refreshes = 0;
  handler = async (config) => {
    if (config.url === "/auth/refresh") refreshes++;
    return fail(config, 400, "INVALID_CURRENT_PASSWORD");
  };
  await assert.rejects(
    store
      .getState()
      .changePassword({
        currentPassword: "wrong",
        newPassword: "A different new passphrase!",
      }),
  );
  assert.equal(refreshes, 0);
  assert.equal(store.getState().user?.id, "1");
});
test("successful password change clears the local platform identity", async () => {
  await login();
  handler = async (config) => respond(config);
  await store
    .getState()
    .changePassword({
      currentPassword: "current",
      newPassword: "New long varied passphrase!",
    });
  assert.equal(store.getState().user, null);
  assert.deepEqual(api.platformAuthorization(), {});
});
test("a late protected response is cancelled after logout", async () => {
  await login();
  const gate = deferred<void>();
  handler = async (config) => {
    if (config.url === "/old-data") await gate.promise;
    return respond(config);
  };
  const pending = api.platformClient.get("/old-data");
  const rejected = assert.rejects(pending, (error) => axios.isCancel(error));
  await tick();
  await store.getState().logout();
  gate.resolve();
  await rejected;
  assert.equal(store.getState().user, null);
});
test("identity changes on refresh never retry the previous identity write", async () => {
  await login();
  let writes = 0;
  handler = async (config) => {
    if (config.url === "/auth/refresh")
      return respond(config, { data: tokens("2") });
    writes++;
    return fail(config, 401);
  };
  await assert.rejects(
    api.platformClient.post("/previous-identity-action"),
    (error) => axios.isCancel(error),
  );
  assert.equal(writes, 1);
  assert.equal(store.getState().user?.id, "2");
});
test("password changes do not retry against an identity restored from another tab", async () => {
  await login();
  let changes = 0;
  handler = async (config) => {
    if (config.url === "/auth/refresh")
      return respond(config, { data: tokens("2") });
    changes++;
    return fail(config, 401);
  };
  await assert.rejects(
    store
      .getState()
      .changePassword({
        currentPassword: "current",
        newPassword: "New long varied passphrase!",
      }),
    (error) => axios.isCancel(error),
  );
  assert.equal(changes, 1);
  assert.equal(store.getState().user?.id, "2");
});
test("restoration reports temporary connection errors and recovers on retry", async () => {
  handler = async (config) => {
    throw new AxiosError("Synthetic offline", "ERR_NETWORK", config);
  };
  await store.getState().checkAuth();
  assert.ok(store.getState().restoreError);
  assert.equal(store.getState().isLoading, false);
  handler = async (config) => respond(config, { data: tokens() });
  await store.getState().checkAuth();
  assert.equal(store.getState().restoreError, null);
  assert.equal(store.getState().user?.id, "1");
});
