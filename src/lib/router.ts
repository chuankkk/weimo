import { useSyncExternalStore } from "react";
import type { TabKey } from "../types";

const TAB_KEYS: TabKey[] = ["home", "banks", "practice", "wrong", "exam", "settings"];

export interface Route {
  tab: TabKey;
  params: URLSearchParams;
  hash: string;
}

const isTab = (value: string): value is TabKey => (TAB_KEYS as string[]).includes(value);

let cachedHash: string | null = null;
let cachedVersion = -1;
let cachedRoute: Route | null = null;
/** 相同地址重复跳转时的版本号，保证订阅者收到一次新的快照。 */
let version = 0;

const readRoute = (): Route => {
  const hash = typeof window === "undefined" ? "" : window.location.hash;
  if (cachedHash === hash && cachedVersion === version && cachedRoute) return cachedRoute;
  const raw = hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const tab = isTab(path) ? path : "home";
  cachedHash = hash;
  cachedVersion = version;
  cachedRoute = { tab, params: new URLSearchParams(query), hash };
  return cachedRoute;
};

const subscribe = (callback: () => void) => {
  const handler = () => callback();
  window.addEventListener("hashchange", handler);
  window.addEventListener("popstate", handler);
  window.addEventListener("app:routechange", handler);
  return () => {
    window.removeEventListener("hashchange", handler);
    window.removeEventListener("popstate", handler);
    window.removeEventListener("app:routechange", handler);
  };
};

export const useRoute = () => useSyncExternalStore(subscribe, readRoute, readRoute);

export const buildHref = (tab: TabKey, params?: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
  }
  const query = search.toString();
  return `#/${tab}${query ? `?${query}` : ""}`;
};

export const navigate = (tab: TabKey, params?: Record<string, string | undefined>) => {
  const target = buildHref(tab, params);
  if (window.location.hash === target) {
    // 相同地址时手动通知一次，方便页面内重复跳转（例如重新打开练习）。
    version += 1;
    window.dispatchEvent(new Event("app:routechange"));
    return;
  }
  window.location.hash = target;
  // hashchange 触发后 readRoute 会发现 hash 变化；这里无需递增版本。
};
