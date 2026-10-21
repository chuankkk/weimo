import type { AppState } from "../types";
import { SCHEMA_VERSION, STORAGE_KEY } from "../lib/constants";
import { getSeedState } from "./seed";
import { normalizeState } from "./normalize";

export { normalizeState } from "./normalize";

export interface LoadResult {
  state: AppState;
  warning?: string;
}

/**
 * 从 localStorage 载入并归一化。
 * 解析失败时保留原始字符串（用户仍可通过导出/开发者工具找回），只回退到演示数据。
 */
export const loadState = (): LoadResult => {
  if (typeof window === "undefined") return { state: getSeedState() };
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: getSeedState(), warning: "浏览器禁用了本地存储，本次数据无法保存。" };
  }
  if (!raw) return { state: getSeedState() };
  try {
    return { state: normalizeState(JSON.parse(raw)) };
  } catch {
    // 解析失败时先把原文另存一份，避免随后的自动保存覆盖用户数据。
    let preserved = false;
    try {
      window.localStorage.setItem(`${STORAGE_KEY}.corrupt`, raw);
      preserved = true;
    } catch {
      preserved = false;
    }
    return {
      state: getSeedState(),
      warning: preserved
        ? "本地数据解析失败，已载入演示数据。原始数据已另存为恢复副本，请先导出备份再继续操作。"
        : "本地数据解析失败，已载入演示数据。原数据仍保留在浏览器中，请先导出备份再继续操作。"
    };
  }
};

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/** 序列化并写入本地存储；失败时返回可展示的中文原因。 */
export const saveState = (state: AppState): SaveResult => {
  try {
    const payload = JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION });
    window.localStorage.setItem(STORAGE_KEY, payload);
    return { ok: true };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const quota = name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
    return {
      ok: false,
      error: quota
        ? "本地存储空间不足，请先导出备份并清理数据。"
        : "本地保存失败，请检查浏览器存储权限。"
    };
  }
};

export const resetState = (): AppState => {
  const state = getSeedState();
  saveState(state);
  return state;
};

/** 当前 localStorage 中应用数据的字节数（用于“我的 → 数据”）。 */
export const storageUsage = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
    return new Blob([raw]).size;
  } catch {
    return 0;
  }
};
