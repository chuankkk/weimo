import { Capacitor } from "@capacitor/core";
import {
  BookOpen,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  Info,
  Moon,
  Monitor,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2
} from "lucide-react";
import { useApp } from "../store/AppStore";
import { storageUsage } from "../data/storage";
import { formatFileSize } from "../lib/text";
import { useDocumentTitle } from "../lib/hooks";
import { APP_NAME, APP_SLOGAN, APP_VERSION } from "../lib/constants";
import { formatDate } from "../lib/date";
import { DataTools } from "../components/DataTools";
import {
  Button,
  Chip,
  SectionHead,
  SectionNav,
  StatCard,
  Stepper,
  Switch
} from "../components/ui";
import { cn } from "../lib/text";
import type { ThemeMode } from "../types";

const themeOptions: { value: ThemeMode; label: string; desc: string; icon: typeof Sun; tone: "light" | "dark" | "system" }[] = [
  { value: "system", label: "跟随系统", desc: "随设备自动切换", icon: Monitor, tone: "system" },
  { value: "light", label: "日宣", desc: "明净宣纸", icon: Sun, tone: "light" },
  { value: "dark", label: "夜墨", desc: "静夜阅读", icon: Moon, tone: "dark" }
];

export function SettingsPage() {
  useDocumentTitle("我的");
  const { state, stats, catalog, update, setSetting, reset, toast, confirm } = useApp();
  const native = Capacitor.isNativePlatform();
  const used = storageUsage();

  const clearProgress = async () => {
    const accepted = await confirm({
      title: "清空学习记录？",
      description: `将删除 ${state.records.length} 条作答记录、${state.wrongs.length} 条错题、${state.notes.length} 条笔记与考试记录；题库和策略会保留。`,
      confirmText: "清空记录",
      tone: "danger"
    });
    if (!accepted) return;
    update((current) => ({
      ...current,
      records: [],
      wrongs: [],
      notes: [],
      examSessions: [],
      practiceSession: null
    }));
    toast("学习记录已清空", { tone: "success" });
  };

  const resetAll = async () => {
    const accepted = await confirm({
      title: "恢复演示数据？",
      description: "当前所有题库、题目、学习记录与策略都会被演示数据替换。建议先导出完整备份。",
      confirmText: "恢复演示数据",
      tone: "danger"
    });
    if (!accepted) return;
    reset();
  };

  return (
    <section className="page settings-page">
      <div className="page-head">
        <div className="page-head-copy">
          <p className="eyebrow">我的</p>
          <h1>我的闱墨</h1>
          <p className="page-head-sub">外观、学习偏好与本地数据，都由你掌握。</p>
        </div>
      </div>

      <SectionNav
        items={[
          { id: "settings-theme", label: "外观" },
          { id: "settings-prefs", label: "学习偏好" },
          { id: "settings-data", label: "数据" },
          { id: "settings-maintenance", label: "维护" }
        ]}
      />

      <div className="profile-card">
        <img src="/assets/weimo-mark.svg" alt="" className="profile-mark" />
        <div className="profile-copy">
          <div className="profile-title">
            <strong>{APP_NAME}</strong>
            <span>v{APP_VERSION}</span>
            <Chip tone="jade">{native ? "Android 客户端" : "Web 应用"}</Chip>
          </div>
          <p>{APP_SLOGAN}。所有题库与学习记录默认保存在本机，不依赖账号与网络。</p>
          <div className="profile-stats">
            <span>{catalog.visibleBanks.length} 个题库</span>
            <span>{stats.totalQuestions} 道题</span>
            <span>{stats.answered} 次作答</span>
            <span>{formatDate(new Date())}</span>
          </div>
        </div>
      </div>

      <SectionHead id="settings-theme" icon={<Sparkles />} title="外观" hint="选择后即时生效并保存" />
      <div className="theme-picker" role="group" aria-label="外观主题">
        {themeOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              className={cn("theme-card", state.settings.theme === option.value && "is-active")}
              onClick={() => setSetting("theme", option.value)}
              aria-pressed={state.settings.theme === option.value}
            >
              <span className={cn("theme-preview", `is-${option.tone}`)} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="theme-copy">
                <Icon aria-hidden="true" />
                <strong>{option.label}</strong>
                <small>{option.desc}</small>
              </span>
              {state.settings.theme === option.value ? (
                <span className="theme-check" aria-hidden="true">
                  <CheckCircle2 />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <SectionHead id="settings-prefs" icon={<Settings2 />} title="学习偏好" hint="影响智能抽题与每日目标" />
      <div className="settings-card card">
        <div className="setting-row">
          <span>
            <strong>答对后自动下一题</strong>
            <small>答对后等待约 1.4 秒自动进入下一题，可随时手动点击</small>
          </span>
          <Switch
            checked={state.settings.autoNext}
            onChange={(value) => setSetting("autoNext", value)}
            label="答对后自动下一题"
          />
        </div>

        <div className="setting-row">
          <span>
            <strong>每日练习目标</strong>
            <small>首页环形进度与今日完成度会按这个目标计算</small>
          </span>
          <div className="setting-target">
            <Stepper
              value={state.settings.reviewDailyTarget}
              onChange={(value) => setSetting("reviewDailyTarget", value)}
              min={5}
              max={200}
              step={5}
              label="每日练习目标"
            />
            <span>题 / 天</span>
          </div>
        </div>

        <label className="setting-row stacked">
          <span>
            <strong>错题加权强度</strong>
            <small>智能随机时，错题被抽中的概率倍数（当前 {state.settings.weightedWrongStrength} 级）</small>
          </span>
          <div className="slider-row">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={state.settings.weightedWrongStrength}
              onChange={(event) => setSetting("weightedWrongStrength", Number(event.target.value))}
              aria-label="错题加权强度"
            />
            <span>{state.settings.weightedWrongStrength}</span>
          </div>
        </label>

        <label className="setting-row stacked">
          <span>
            <strong>知识点弱项加权</strong>
            <small>同一知识点错误率越高，相关题目越容易回流（当前 {state.settings.weightedKnowledgeStrength} 级）</small>
          </span>
          <div className="slider-row">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={state.settings.weightedKnowledgeStrength}
              onChange={(event) => setSetting("weightedKnowledgeStrength", Number(event.target.value))}
              aria-label="知识点弱项加权"
            />
            <span>{state.settings.weightedKnowledgeStrength}</span>
          </div>
        </label>
      </div>

      <SectionHead id="settings-data" icon={<Database />} title="数据" hint="导入、导出与本地存储" />
      <div className="storage-card card">
        <div className="storage-head">
          <span className="storage-icon">
            <HardDrive aria-hidden="true" />
          </span>
          <div>
            <strong>本地存储占用</strong>
            <p>
              {formatFileSize(used)} · {stats.totalQuestions} 道题 · {stats.answered} 条记录
            </p>
          </div>
          <Chip tone="jade">
            <ShieldCheck aria-hidden="true" /> 仅本机
          </Chip>
        </div>
        <div className="storage-stats">
          <StatCard label="题库" value={catalog.visibleBanks.length} unit="个" hint={`${catalog.roots.length} 个一级题库`} />
          <StatCard label="错题" value={stats.wrongActive} unit="道" tone="rose" hint={`已掌握 ${stats.wrongMastered}`} />
          <StatCard label="考试记录" value={state.examSessions.filter((item) => item.status !== "running").length} unit="场" tone="gold" />
        </div>
      </div>

      <DataTools />

      <SectionHead id="settings-maintenance" icon={<RotateCcw />} title="维护" hint="危险操作会在执行前二次确认" />
      <div className="maintenance-card card">
        <div className="maintenance-row">
          <span>
            <strong>清空学习记录</strong>
            <small>保留题库与考试策略，只重置作答、错题、笔记与考试历史</small>
          </span>
          <Button variant="ghost" icon={<Trash2 />} onClick={() => void clearProgress()}>
            清空记录
          </Button>
        </div>
        <div className="maintenance-row is-danger">
          <span>
            <strong>恢复演示数据</strong>
            <small>用内置演示题库替换当前全部数据，请先导出完整备份</small>
          </span>
          <Button variant="danger" icon={<Download />} onClick={() => void resetAll()}>
            恢复演示
          </Button>
        </div>
      </div>

      <div className="settings-note">
        <Info aria-hidden="true" />
        <p>
          闱墨采用本地优先设计：题库、作答、笔记与错题都保存在浏览器或 App 的本地存储中。更换设备前，请先导出
          JSON 完整备份。Web 版可通过浏览器“添加到主屏幕”获得接近原生应用的体验。
        </p>
      </div>

      <div className="about-card">
        <img src="/assets/weimo-mark.svg" alt="" />
        <div>
          <strong>闱墨</strong>
          <p>{APP_SLOGAN}。用一张安静的书桌，装下你的全部题卷。</p>
          <div className="about-tags">
            <Chip>本地优先</Chip>
            <Chip>无需登录</Chip>
            <Chip>离线可用</Chip>
            <Chip>
              <BookOpen aria-hidden="true" /> 版本 {APP_VERSION}
            </Chip>
          </div>
        </div>
      </div>

      <p className="settings-footnote">
        <Target aria-hidden="true" /> 今日目标 {state.settings.reviewDailyTarget} 题 · 已完成 {stats.todayCount} 题 ·
        连续 {stats.streak} 天
      </p>
    </section>
  );
}
