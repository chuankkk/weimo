import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { AppState, Settings } from "../types";
import { createCatalog, type Catalog } from "../lib/catalog";
import { computeKnowledgeRates, computeStats, type KnowledgeRate, type Stats } from "../lib/stats";
import { loadState, resetState, saveState } from "../data/storage";

export type ToastTone = "info" | "success" | "error";

export interface ToastOptions {
  tone?: ToastTone;
  duration?: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
  duration: number;
}

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
  /** 操作可撤销/可从回收站恢复时，确认框不再提示“无法撤销”。 */
  recoverable?: boolean;
}

export interface ConfirmDialogState extends ConfirmOptions {
  id: number;
}

/** 数据与派生指标：跟随状态变化。 */
export interface AppData {
  state: AppState;
  catalog: Catalog;
  stats: Stats;
  knowledgeRates: Map<string, KnowledgeRate>;
  resolvedTheme: "light" | "dark";
  storageWarning?: string;
}

/** 操作函数：引用稳定，可在 effect 依赖中安全使用。 */
export interface AppActions {
  update: (updater: (state: AppState) => AppState) => void;
  replace: (next: AppState) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

/** 全局反馈层：只有 toast / confirm 变化时才更新。 */
export interface AppUi {
  toast: (message: string, options?: ToastOptions) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmState: ConfirmDialogState | null;
  resolveConfirm: (value: boolean) => void;
}

export type AppStore = AppData & AppActions & AppUi;
export type AppCore = AppData & AppActions;

const DataContext = createContext<AppCore | null>(null);
const UiContext = createContext<AppUi | null>(null);

const useSystemDark = () => {
  const [dark, setDark] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setDark(event.matches);
    setDark(query.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return dark;
};

const THEME_COLORS = { light: "#F5F0E6", dark: "#121513" } as const;

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = useRef<ReturnType<typeof loadState> | null>(null);
  if (!initial.current) initial.current = loadState();
  const [state, setState] = useState<AppState>(initial.current.state);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const saveErrorRef = useRef("");
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef(new Map<string, number>());
  const confirmIdRef = useRef(0);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const systemDark = useSystemDark();

  const update = useCallback((updater: (current: AppState) => AppState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  const replace = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const tone = options.tone ?? "info";
      const duration = options.duration ?? (tone === "error" ? 4200 : 2800);
      const id = `toast-${++toastIdRef.current}`;
      // 相同文案短时间内重复出现时只保留最新一条，避免刷屏。
      setToasts((current) => [...current.filter((item) => item.message !== message).slice(-2), { id, message, tone, duration }]);
      toastTimersRef.current.set(
        id,
        window.setTimeout(() => dismissToast(id), duration)
      );
    },
    [dismissToast]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
        confirmResolverRef.current = null;
      }
      confirmResolverRef.current = resolve;
      setConfirmState({ ...options, id: ++confirmIdRef.current });
    });
  }, []);

  const resolveConfirm = useCallback((value: boolean) => {
    confirmResolverRef.current?.(value);
    confirmResolverRef.current = null;
    setConfirmState(null);
  }, []);

  const reset = useCallback(() => {
    const next = resetState();
    replace(next);
    toast("已恢复演示数据", { tone: "success" });
  }, [replace, toast]);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  // 防抖持久化：连续作答时避免每题同步写满整个 localStorage。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = saveState(stateRef.current);
      if (!result.ok && result.error && result.error !== saveErrorRef.current) {
        saveErrorRef.current = result.error;
        toast(result.error, { tone: "error", duration: 6000 });
      }
      if (result.ok) saveErrorRef.current = "";
    }, 280);
    return () => window.clearTimeout(timer);
  }, [state, toast]);

  // 页面隐藏/关闭前立即落盘，避免防抖窗口内丢数据。
  useEffect(() => {
    const flush = () => {
      saveState(stateRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (initial.current?.warning) toast(initial.current.warning, { tone: "error", duration: 7000 });
    // 只在首次挂载时提示
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catalog = useMemo(() => createCatalog(state.banks, state.questions), [state.banks, state.questions]);
  const stats = useMemo(
    () => computeStats(state, catalog),
    // records / wrongs / daily target 变化时重算；catalog 覆盖题库与题目变化
    [state.records, state.wrongs, state.settings.reviewDailyTarget, catalog] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const knowledgeRates = useMemo(() => computeKnowledgeRates(state.records, catalog), [state.records, catalog]);

  const resolvedTheme = state.settings.theme === "system" ? (systemDark ? "dark" : "light") : state.settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themeMode = state.settings.theme;
    root.style.colorScheme = resolvedTheme;
    // 两个 theme-color meta 分别服务不同 prefers-color-scheme；统一写入当前解析值。
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute("content", THEME_COLORS[resolvedTheme]);
    }
  }, [resolvedTheme, state.settings.theme]);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setState((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  }, []);

  const dataValue = useMemo<AppCore>(
    () => ({
      state,
      catalog,
      stats,
      knowledgeRates,
      resolvedTheme,
      update,
      replace,
      setSetting,
      reset,
      storageWarning: initial.current?.warning
    }),
    [state, catalog, stats, knowledgeRates, resolvedTheme, update, replace, setSetting, reset]
  );

  const uiValue = useMemo<AppUi>(
    () => ({ toast, toasts, dismissToast, confirm, confirmState, resolveConfirm }),
    [toast, toasts, dismissToast, confirm, confirmState, resolveConfirm]
  );

  return (
    <UiContext.Provider value={uiValue}>
      <DataContext.Provider value={dataValue}>{children}</DataContext.Provider>
    </UiContext.Provider>
  );
}

const useData = () => {
  const value = useContext(DataContext);
  if (!value) throw new Error("useApp 必须在 AppProvider 内使用");
  return value;
};

export const useUi = () => {
  const value = useContext(UiContext);
  if (!value) throw new Error("useUi 必须在 AppProvider 内使用");
  return value;
};

/** 页面使用的合并入口：数据 + 操作 + 反馈。 */
export const useApp = (): AppStore => {
  const data = useData();
  const ui = useContext(UiContext);
  if (!ui) throw new Error("useApp 必须在 AppProvider 内使用");
  return { ...data, ...ui };
};
