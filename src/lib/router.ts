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
let cachedRoute: Route | null = null;

const readRoute = (): Route => {
  const hash = typeof window === "undefined" ? "" : window.location.hash;
  if (cachedHash === hash && cachedRoute) return cachedRoute;
  const raw = hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const tab = isTab(path) ? path : "home";
  cachedHash = hash;
  cachedRoute = { tab, params: new URLSearchParams(query), hash };
  return cachedRoute;
};

const subscribe = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
  };
};

export const useRoute = () => useSyncExternalStore(subscribe, readRoute, readRoute);

export const navigate = (tab: TabKey, params?: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
  }
  const query = search.toString();
  const target = `#/${tab}${query ? `?${query}` : ""}`;
  if (window.location.hash === target) {
    // 相同地址时手动通知一次，方便页面内重复跳转
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = target;
};

export const navigateHome = () => navigate("home");

export const routeTab = readRoute;
