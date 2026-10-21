import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  ChevronRight,
  Flame,
  Moon,
  Plus,
  RotateCcw,
  Settings,
  Shuffle,
  Sparkles,
  Sun,
  Target,
  Timer,
  Upload
} from "lucide-react";
import { useApp } from "../store/AppStore";
import { navigate } from "../lib/router";
import { formatDate, localDateKey, relativeTime } from "../lib/date";
import { computeBankProgress, weakKnowledgePoints } from "../lib/stats";
import { estimateMinutes } from "../lib/text";
import { useDocumentTitle } from "../lib/hooks";
import { modeLabel } from "../lib/constants";
import { cn } from "../lib/text";
import type { PracticeMode } from "../types";
import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  ProgressBar,
  ProgressRing,
  SectionHead,
  SectionNav,
  Segmented,
  StatCard,
  TypeBadge
} from "../components/ui";

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了，注意休息";
  if (hour < 11) return "早上好，开始今天的研习";
  if (hour < 14) return "中午好，做几道题换换脑子";
  if (hour < 18) return "下午好，保持专注";
  return "晚上好，今天的墨迹还新";
};

const quickActions: { mode: PracticeMode; icon: typeof BookOpen; title: string; desc: string; tab?: "practice" | "wrong" }[] = [
  { mode: "sequence", icon: BookOpen, title: "顺序刷题", desc: "按题库顺序稳步推进" },
  { mode: "random", icon: Shuffle, title: "随机刷题", desc: "混合抽题，打散定式" },
  { mode: "weighted", icon: Brain, title: "智能练习", desc: "错题与弱项加权优先" },
  { mode: "wrong", icon: RotateCcw, title: "错题重刷", desc: "只刷待复习的错题", tab: "wrong" }
];

export function HomePage() {
  useDocumentTitle("首页");
  const { state, stats, catalog, knowledgeRates, resolvedTheme, setSetting } = useApp();
  const [insightView, setInsightView] = useState<"activity" | "weak">("activity");
  const weak = weakKnowledgePoints(knowledgeRates, 4);
  const session = state.practiceSession && !state.practiceSession.completedAt ? state.practiceSession : null;
  const emptyLibrary = catalog.roots.length === 0 && state.questions.length === 0;
  const recent = useMemo(() => {
    const rows: { id: string; stem: string; type: (typeof catalog.questions)[number]["type"]; correct: boolean; at: string }[] = [];
    for (let index = state.records.length - 1; index >= 0 && rows.length < 3; index -= 1) {
      const record = state.records[index];
      const question = catalog.questionById.get(record.questionId);
      if (!question) continue;
      rows.push({
        id: record.id,
        stem: question.stem,
        type: question.type,
        correct: record.isCorrect,
        at: record.answeredAt
      });
    }
    return rows;
  }, [state.records, catalog]);

  const bankProgress = useMemo(() => computeBankProgress(state, catalog), [state, catalog]);

  const todayGoalDone = stats.todayCount >= stats.todayGoal;
  const activityMax = useMemo(
    () => Math.max(1, ...stats.activity.map((item) => item.total)),
    [stats.activity]
  );
  const activityTotal = useMemo(() => stats.activity.reduce((sum, day) => sum + day.total, 0), [stats.activity]);
  const toggleTheme = () => setSetting("theme", resolvedTheme === "dark" ? "light" : "dark");
  const sectionItems = emptyLibrary
    ? []
    : [
        { id: "home-start", label: "开始学习" },
        { id: "home-insights", label: "学习动态" },
        ...(recent.length ? [{ id: "home-recent", label: "最近作答" }] : []),
        { id: "home-banks", label: "题库概览" }
      ];

  const brief = session
    ? {
        key: "resume",
        eyebrow: "继续上次练习",
        title: `${modeLabel[session.mode]} · 第 ${session.currentIndex + 1} / ${session.questionIds.length} 题`,
        detail: `已完成 ${Object.keys(session.submitted).length} 题，预计还需 ${estimateMinutes(
          Math.max(1, session.questionIds.length - Object.keys(session.submitted).length)
        )} 分钟`,
        action: "继续练习",
        icon: <RotateCcw />,
        go: () => navigate("practice", { run: "1" })
      }
    : stats.dueReviews
      ? {
          key: "review",
          eyebrow: "今日复习",
          title: `${stats.dueReviews} 道错题已到复习时间`,
          detail: "按遗忘曲线优先处理到期错题，巩固比刷新更重要",
          action: "开始复习",
          icon: <Sparkles />,
          go: () => navigate("wrong")
        }
      : !todayGoalDone
        ? {
            key: "goal",
            eyebrow: "今日目标",
            title: `还差 ${Math.max(0, stats.todayGoal - stats.todayCount)} 题达成今日目标`,
            detail: "智能练习会优先抽取错题、薄弱知识点与久未练习的题目",
            action: "智能练习",
            icon: <Sparkles />,
            go: () => navigate("practice", { mode: "weighted" })
          }
        : {
            key: "done",
            eyebrow: "今日目标已完成",
            title: "墨迹正好，保持这个节奏",
            detail: "可以回看错题，或做一组模拟考试检验掌握程度",
            action: "模拟考试",
            icon: <Timer />,
            go: () => navigate("exam")
          };

  return (
    <section className="page home-page">
      <header className="home-hero">
        <img
          className="home-hero-art"
          src="/assets/weimo-ink-hero.jpg"
          srcSet="/assets/weimo-ink-hero-1200.jpg 1200w, /assets/weimo-ink-hero.jpg 1672w"
          sizes="(min-width: 1100px) 560px, (min-width: 760px) 66vw, 100vw"
          alt=""
          width={1672}
          height={941}
          decoding="async"
        />
        <div className="home-hero-inner">
          <div className="home-top">
            <div className="brand-lockup">
              <img className="brand-mark" src="/assets/weimo-mark.svg" alt="" />
              <div>
                <strong>闱墨</strong>
                <span>本地题库 · 一卷一答</span>
              </div>
            </div>
            <div className="home-top-actions">
              <IconButton label={resolvedTheme === "dark" ? "切换到日宣模式" : "切换到夜墨模式"} onClick={toggleTheme}>
                {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              </IconButton>
              <IconButton label="打开我的" onClick={() => navigate("settings")}>
                <Settings />
              </IconButton>
            </div>
          </div>

          <div className="home-hero-main">
            <div className="hero-copy">
              <p className="eyebrow">
                <CalendarDays aria-hidden="true" />
                {formatDate(new Date(), true)}
              </p>
              <h1>
                落笔有声，
                <br />
                温故知新。
              </h1>
              <p className="hero-description">
                {greeting()}。从题库、错题到模考，让每一次落笔都留下可回看的进步。
              </p>
            </div>
            <div className={cn("hero-goal", todayGoalDone && "is-done")}>
              <ProgressRing value={stats.goalProgress} size={94} stroke={6}>
                <strong>{stats.todayCount}</strong>
                <small>/ {stats.todayGoal}</small>
              </ProgressRing>
              <span>{todayGoalDone ? "今日目标完成" : "今日研习目标"}</span>
              <small>
                {stats.streak > 0 ? (
                  <>
                    <Flame aria-hidden="true" /> 连续 {stats.streak} 天
                  </>
                ) : (
                  "今天开始记录"
                )}
              </small>
            </div>
          </div>

          <div className="hero-actions">
            <Button
              size="lg"
              icon={emptyLibrary ? <Upload /> : session ? <RotateCcw /> : <Sparkles />}
              onClick={() =>
                emptyLibrary
                  ? navigate("banks", { view: "import" })
                  : navigate("practice", session ? { run: "1" } : { mode: "weighted" })
              }
            >
              {emptyLibrary
                ? "导入题库"
                : session
                  ? `继续练习 · ${session.currentIndex + 1}/${session.questionIds.length}`
                  : "开始智能练习"}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={emptyLibrary ? <Plus /> : <Timer />}
              onClick={() => (emptyLibrary ? navigate("banks") : navigate("exam"))}
            >
              {emptyLibrary ? "新建题库" : "模拟考试"}
            </Button>
          </div>
        </div>
      </header>

      <SectionNav items={sectionItems} />

      {emptyLibrary ? (
        <section className="card onboarding-card" id="home-onboarding">
          <div className="onboarding-head">
            <span className="onboarding-icon">
              <BookOpen aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">空白题库 · 从零开始</p>
              <h2>建立你的第一册题库</h2>
              <p>这是不含演示数据的空白版本。导入现成题库，或先建一个空题库再手工录入题目。</p>
            </div>
          </div>
          <div className="onboarding-actions">
            <Button icon={<Upload />} onClick={() => navigate("banks", { view: "import" })}>
              导入题库
            </Button>
            <Button variant="ghost" icon={<Plus />} onClick={() => navigate("banks")}>
              新建题库
            </Button>
          </div>
          <ol className="onboarding-steps">
            <li>
              <b>01</b>
              <span>
                <strong>导入或新建题库</strong>
                <small>支持 Excel / CSV / JSON，也可以手动录入。</small>
              </span>
            </li>
            <li>
              <b>02</b>
              <span>
                <strong>选择练习方式</strong>
                <small>顺序、随机、智能加权或错题重刷。</small>
              </span>
            </li>
            <li>
              <b>03</b>
              <span>
                <strong>导出备份</strong>
                <small>数据只保存在本机，换机前先导出完整备份。</small>
              </span>
            </li>
          </ol>
        </section>
      ) : (
        <div className="home-content">
          <section className={cn("home-brief", `is-${brief.key}`)} aria-label="今日安排">
            <div className="brief-copy">
              <p className="eyebrow">{brief.eyebrow}</p>
              <strong>{brief.title}</strong>
              <small>{brief.detail}</small>
            </div>
            <div className="brief-goal">
              <ProgressBar value={stats.goalProgress} size="sm" label="今日目标进度" />
              <span>
                今日 {stats.todayCount} / {stats.todayGoal} 题
                {stats.dueReviews ? ` · 待复习 ${stats.dueReviews}` : ""}
              </span>
            </div>
            <Button size="sm" icon={brief.icon} onClick={brief.go}>
              {brief.action}
            </Button>
          </section>

          <div className="stat-strip home-stats">
            <StatCard label="题目总量" value={stats.totalQuestions} unit="题" hint={`${stats.totalBanks} 个一级题库`} />
            <StatCard label="综合正确率" value={stats.correctRate} unit="%" hint={`累计作答 ${stats.answered} 次`} tone="jade" />
            <StatCard label="连续练习" value={stats.streak} unit="天" hint={stats.streak ? "保持这个节奏" : "今天开始记录"} tone="gold" icon={<Flame />} />
            <StatCard label="待复习" value={stats.dueReviews} unit="题" hint={`活跃错题 ${stats.wrongActive} 道`} tone="rose" />
          </div>

          <SectionHead id="home-start" icon={<Sparkles />} title="开始学习" hint="四种节奏，按当前状态选择" />
          <div className="quick-grid">
            {quickActions.map(({ mode, icon: Icon, title, desc, tab }) => (
              <button
                key={mode}
                type="button"
                className={`quick-card tone-${mode}`}
                onClick={() => (tab === "wrong" ? navigate("wrong") : navigate("practice", { mode }))}
              >
                <span className="quick-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="quick-copy">
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </span>
                <ArrowRight className="quick-arrow" aria-hidden="true" />
              </button>
            ))}
          </div>

          <SectionHead id="home-insights" icon={<Target />} title="学习动态" hint="练习量、待复习与薄弱知识点" />
          <div className="insights-switch">
            <Segmented
              ariaLabel="学习动态视图"
              value={insightView}
              onChange={setInsightView}
              options={[
                { value: "activity", label: "练习活跃度" },
                { value: "weak", label: "薄弱知识点", badge: weak.length || undefined }
              ]}
            />
          </div>
          <div className="home-split insights-grid" data-view={insightView}>
            <section className="card activity-card">
              <div className="card-head">
                <div>
                  <h2>近两周练习</h2>
                  <p>
                    共 {activityTotal} 题 · 今日 {stats.todayCount} 题
                  </p>
                </div>
                <span className="activity-chip">
                  <Target aria-hidden="true" />
                  {todayGoalDone ? "已达标" : `还差 ${Math.max(0, stats.todayGoal - stats.todayCount)} 题`}
                </span>
              </div>
              <div className="activity-chart-wrap">
                <div className="activity-chart" aria-label="近十四天练习量">
                  {stats.activity.map((day, index) => {
                    const height = day.total ? Math.max(8, Math.round((day.total / activityMax) * 100)) : 4;
                    const isToday = day.key === localDateKey();
                    const showLabel = index === 0 || index === 7 || index === stats.activity.length - 1;
                    return (
                      <div className="activity-col" key={day.key} title={`${day.label} · ${day.total} 题`}>
                        <span
                          className={cn("activity-bar", isToday && "is-today", day.total === 0 && "is-empty")}
                          style={{ height: `${height}%` }}
                        />
                        <small>{showLabel ? day.label : "\u00a0"}</small>
                      </div>
                    );
                  })}
                </div>
                {activityTotal === 0 ? (
                  <span className="activity-empty">完成第一组练习后，这里会留下你的节奏</span>
                ) : null}
              </div>
              <div className="activity-foot">
                <span>正确率 {stats.todayCorrectRate}%</span>
                <span>待复习 {stats.dueReviews} 题</span>
                <button type="button" onClick={() => navigate("wrong")}>
                  打开错题本 <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </section>

            <section className="card weak-card">
              <div className="card-head">
                <div>
                  <h2>薄弱知识点</h2>
                  <p>{weak.length ? "按近期错误率排序" : "完成练习后自动生成"}</p>
                </div>
                <span className="weak-count">{weak.length || "—"}</span>
              </div>
              {weak.length ? (
                <ul className="weak-list">
                  {weak.map((item) => (
                    <li key={item.name}>
                      <div className="weak-row">
                        <strong>{item.name}</strong>
                        <span>{Math.round(item.rate * 100)}%</span>
                      </div>
                      <ProgressBar value={item.rate} tone="rose" size="sm" label={`${item.name} 错误率`} />
                      <small>
                        答错 {item.wrong} / {item.total} 次
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="weak-empty">
                  <Target aria-hidden="true" />
                  <p>再完成几组练习，这里会列出需要重点回看的知识点。</p>
                </div>
              )}
            </section>
          </div>

          {recent.length ? (
            <>
              <SectionHead
                id="home-recent"
                icon={<CalendarDays />}
                title="最近作答"
                action={
                  <Button variant="quiet" size="sm" onClick={() => navigate("wrong")}>
                    查看错题
                  </Button>
                }
              />
              <div className="recent-card card">
                {recent.map((row) => (
                  <div className="recent-row" key={row.id}>
                    <span className={cn("recent-mark", row.correct ? "is-correct" : "is-wrong")} aria-hidden="true">
                      {row.correct ? "对" : "误"}
                    </span>
                    <div className="recent-copy">
                      <p>{row.stem}</p>
                      <span>
                        <TypeBadge type={row.type} /> {relativeTime(row.at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <SectionHead
            id="home-banks"
            icon={<BookOpen />}
            title="题库概览"
            action={
              <Button variant="quiet" size="sm" onClick={() => navigate("banks")}>
                全部题库 <ArrowRight aria-hidden="true" />
              </Button>
            }
          />
          {bankProgress.length ? (
            <div className="bank-strip-list">
              {bankProgress.map(({ bank, total, answered, wrong, rate }) => (
                <button type="button" className="bank-strip" key={bank.id} onClick={() => navigate("banks", { bank: bank.id })}>
                  <span className="bank-spine" style={{ background: bank.color }} aria-hidden="true" />
                  <span className="bank-strip-copy">
                    <strong>{bank.name}</strong>
                    <small>{bank.description || "暂无描述"}</small>
                  </span>
                  <span className="bank-strip-meta">
                    <b>{total}</b> 题
                    <small>
                      {catalog.childrenOf(bank.id).length} 子库 · {wrong} 错题
                    </small>
                  </span>
                  <span className="bank-strip-progress">
                    <ProgressBar value={rate} size="sm" label={`${bank.name} 进度`} />
                    <small>
                      已练 {answered} / {total}
                    </small>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen />}
              title="还没有题库"
              description="导入 Excel、CSV 或 JSON，几秒钟就能建立自己的题库。"
              action={
                <Button icon={<Sparkles />} onClick={() => navigate("banks")}>
                  去创建题库
                </Button>
              }
            />
          )}
        </div>
      )}

      <div className="home-footnote">
        <Chip tone="jade">本地优先</Chip>
        <Chip>无需登录</Chip>
        <Chip>支持离线</Chip>
        <p>所有题库与学习记录默认保存在这台设备，导出备份即可迁移。</p>
      </div>
    </section>
  );
}
