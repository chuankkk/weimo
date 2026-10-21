import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AppProvider, useApp } from "./store/AppStore";
import { useRoute } from "./lib/router";
import { BottomNav } from "./components/BottomNav";
import { ConfirmHost, ToastViewport } from "./components/overlays";
import { HomePage } from "./pages/HomePage";
import { BanksPage } from "./pages/BanksPage";
import { PracticePage } from "./pages/PracticePage";
import { WrongPage } from "./pages/WrongPage";
import { ExamPage } from "./pages/ExamPage";
import { SettingsPage } from "./pages/SettingsPage";

function AppRoutes() {
  const route = useRoute();
  const { state, stats } = useApp();
  const examSessionParam = route.tab === "exam" ? route.params.get("session") : null;
  const examActive = Boolean(examSessionParam && state.examSessions.some((session) => session.id === examSessionParam));
  const practiceRunning = route.tab === "practice" && route.params.get("run") === "1" && Boolean(state.practiceSession);
  const immersive = practiceRunning || examActive;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [route.hash]);

  return (
    <div className={`app-shell ${immersive ? "is-immersive" : ""}`} data-tab={route.tab}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <main className="app-main" id="main-content">
        {route.tab === "home" ? <HomePage /> : null}
        {route.tab === "banks" ? <BanksPage /> : null}
        {route.tab === "practice" ? <PracticePage /> : null}
        {route.tab === "wrong" ? <WrongPage /> : null}
        {route.tab === "exam" ? <ExamPage /> : null}
        {route.tab === "settings" ? <SettingsPage /> : null}
      </main>
      {!immersive ? <BottomNav active={route.tab} dueCount={stats.dueReviews} /> : null}
    </div>
  );
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("闱墨运行时错误", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="crash-screen">
          <div className="crash-card">
            <span className="crash-icon">
              <AlertTriangle />
            </span>
            <h1>页面遇到了一点问题</h1>
            <p>本地数据仍然保存在设备中。刷新页面通常可以恢复；若问题持续出现，请先不要执行重置操作。</p>
            <pre>{this.state.error.message}</pre>
            <button type="button" className="btn btn-primary btn-md" onClick={() => window.location.reload()}>
              <RefreshCw aria-hidden="true" />
              <span>重新加载</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <AppProvider>
      <AppRoutes />
      <ToastViewport />
      <ConfirmHost />
    </AppProvider>
  );
}

export default App;
