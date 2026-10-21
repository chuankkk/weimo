import { useEffect, useRef, useState } from "react";

/** 以固定频率返回当前时间戳，用于计时展示。 */
export const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
};

export const useElapsed = (startedAt?: string) => {
  const now = useNow(1000);
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  return Number.isNaN(start) ? 0 : Math.max(0, now - start);
};

/** 倒计时；到 0 时只触发一次 onExpire。 */
export const useCountdown = (targetTime: number, onExpire?: () => void) => {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetTime - Date.now()));
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const tick = () => {
      const next = Math.max(0, targetTime - Date.now());
      setRemaining(next);
      if (next <= 0 && !firedRef.current) {
        firedRef.current = true;
        expireRef.current?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [targetTime]);

  return remaining;
};

export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    document.title = title ? `${title} · 闱墨` : "闱墨";
  }, [title]);
};

/** 键盘快捷键：忽略输入框内的按键。 */
export const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
};

export const useKeydown = (handler: (event: KeyboardEvent) => void, enabled = true) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => handlerRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [enabled]);
};
