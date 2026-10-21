import { BookOpen, ClipboardCheck, Home, Layers3, RotateCcw, UserRound } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { TabKey } from "../types";
import { APP_SLOGAN } from "../lib/constants";
import { navigate } from "../lib/router";
import { cn } from "../lib/text";

const items: { tab: TabKey; label: string; icon: ReactNode }[] = [
  { tab: "home", label: "首页", icon: <Home /> },
  { tab: "banks", label: "题库", icon: <Layers3 /> },
  { tab: "practice", label: "练习", icon: <BookOpen /> },
  { tab: "wrong", label: "错题", icon: <RotateCcw /> },
  { tab: "exam", label: "考试", icon: <ClipboardCheck /> },
  { tab: "settings", label: "我的", icon: <UserRound /> }
];

export function BottomNav({ active, dueCount }: { active: TabKey; dueCount: number }) {
  const activeIndex = Math.max(0, items.findIndex((item) => item.tab === active));
  return (
    <nav className="bottom-nav" aria-label="主导航">
      <div className="nav-brand">
        <img src="/assets/weimo-mark.svg" alt="" />
        <div>
          <strong>闱墨</strong>
          <span>{APP_SLOGAN}</span>
        </div>
      </div>
      <div className="nav-items" style={{ "--nav-index": activeIndex } as CSSProperties}>
        <span className="nav-indicator" aria-hidden="true" />
        {items.map((item) => {
          const isActive = active === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              className={cn("nav-item", isActive && "is-active")}
              onClick={() => navigate(item.tab)}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
                {item.tab === "wrong" && dueCount > 0 ? <b className="nav-badge">{dueCount > 99 ? "99+" : dueCount}</b> : null}
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="nav-foot">
        <span className="nav-foot-dot" aria-hidden="true" />
        本地题库 · 数据留在本机
      </div>
    </nav>
  );
}
