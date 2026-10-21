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
import { computeKnowledgeRates, computeStats, type Stats } from "../lib/stats";
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

export interface AppStore {
  state: AppState;
  catalog: Catalog;
  stats: Stats;
  knowledgeRates: ReturnType<typeof computeKnowledgeRates>;
  resolvedTheme: "light" | "dark";
  update: (updater: (state: AppState) => AppState) => void;
  replace: (next: AppState) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
  toast: (message: string, options?: ToastOptions) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmState: ConfirmDialogState | null;
  resolveConfirm: (value: boolean) => void;
  storageWarning?: string;
}

const StoreContext = createContext<AppStore | null>(null);

const useSystemDark = () => {
  const [dark, setDark] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setDark(event.matches);
    setDark(query.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return dark;
};

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
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = `toast-${++toastIdRef.current}`;
      const tone = options.tone ?? "info";
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismissToast(id), options.duration ?? (tone === "error" ? 4200 : 2800));
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

  // 防抖持久化：连续作答时避免每题同步写满整个 localStorage。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = saveState(stateRef.current);
      if (!result.ok && result.error && result.error !== saveErrorRef.current) {
        saveErrorRef.current = result.error;
        toast(result.error, { tone: "error", duration: 6000 });
      }
      if (result.ok) saveErrorRef.current = "";
    }, 240);
    return () => window.clearTimeout(timer);
  }, [state, toast]);

  // 页面隐藏/关闭前立即落盘，避免防抖窗口内丢数据。
  useEffect(() => {
    const flush = () => saveState(stateRef.current);
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
    if (initial.current?.warning) toast(initial.current.warning, { tone: "error", duration: 6000 });
    // 只在首次挂载时提示
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catalog = useMemo(() => createCatalog(state.banks, state.questions), [state.banks, state.questions]);
  const stats = useMemo(
    () => computeStats(state, catalog),
    // records / wrongs / daily target 变化时重算；catalog 覆盖题库与题目变化
    [state.records, state.wrongs, state.settings.reviewDailyTarget, catalog] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const knowledgeRates = useMemo(
    () => computeKnowledgeRates(state.records, catalog),
    [state.records, catalog]
  );

  const resolvedTheme = state.settings.theme === "system" ? (systemDark ? "dark" : "light") : state.settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themeMode = state.settings.theme;
    root.style.colorScheme = resolvedTheme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolvedTheme === "dark" ? "#121513" : "#F5F0E6");
  }, [resolvedTheme, state.settings.theme]);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setState((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  }, []);

  const value = useMemo<AppStore>(
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
      toast,
      toasts,
      dismissToast,
      confirm,
      confirmState,
      resolveConfirm,
      storageWarning: initial.current?.warning
    }),
    [
      state,
      catalog,
      stats,
      knowledgeRates,
      resolvedTheme,
      update,
      replace,
      setSetting,
      reset,
      toast,
      toasts,
      dismissToast,
      confirm,
      confirmState,
      resolveConfirm
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useApp = () => {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useApp 必须在 AppProvider 内使用");
  return value;
};

export const useCatalog = () => useApp().catalog;

export const useStats = () => useApp().stats;
