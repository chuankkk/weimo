import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  RotateCcw,
  SearchX,
  Sparkles,
  Target,
  Trash2,
  Undo2
} from "lucide-react";
import type { PracticeSessionState, WrongStatus } from "../types";
import { useApp } from "../store/AppStore";
import { buildWrongRows, wrongCounts } from "../lib/stats";
import { formatAnswer, uid } from "../lib/text";
import { nowIso, relativeTime, isDue } from "../lib/date";
import { weightedSampleQuestions } from "../lib/quiz";
import { navigate } from "../lib/router";
import { updateWrongStatus } from "../store/actions";
import { useDocumentTitle } from "../lib/hooks";
import {
  Button,
  EmptyState,
  IconButton,
  ProgressBar,
  SearchField,
  Segmented,
  StatCard,
  TypeBadge
} from "../components/ui";
import { cn } from "../lib/text";

const statusTabs: { value: WrongStatus; label: string }[] = [
  { value: "active", label: "待复习" },
  { value: "mastered", label: "已掌握" },
  { value: "ignored", label: "已忽略" }
];

export function WrongPage() {
  useDocumentTitle("错题本");
  const { state, catalog, knowledgeRates, update, toast, confirm } = useApp();
  const [status, setStatus] = useState<WrongStatus>("active");
  const [bankId, setBankId] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(20);
  const deferredKeyword = useDeferredValue(keyword);

  useEffect(() => {
    setVisibleCount(20);
  }, [status, bankId, deferredKeyword]);

  const counts = useMemo(
    () => wrongCounts(state, catalog, bankId === "all" ? undefined : bankId),
    [state, catalog, bankId]
  );

  const rows = useMemo(() => {
    const list = buildWrongRows(state, catalog, bankId === "all" ? undefined : bankId).filter(
      (row) => row.wrong.status === status
    );
    const query = deferredKeyword.trim().toLowerCase();
    const filtered = query
      ? list.filter(({ question }) =>
          [question.stem, question.knowledgePoints.join(" "), question.tags.join(" "), catalog.bankName(question.bankId)]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
      : list;
    return [...filtered].sort(
      (a, b) => Number(isDue(b.wrong.nextReviewAt)) - Number(isDue(a.wrong.nextReviewAt)) || b.wrong.lastWrongAt.localeCompare(a.wrong.lastWrongAt)
    );
  }, [state, catalog, bankId, status, deferredKeyword]);

  const visibleRows = rows.slice(0, visibleCount);

  const bankOptions = useMemo(
    () =>
      catalog.roots.flatMap((root) => [
        { id: root.id, label: root.name, depth: 0 },
        ...catalog.childrenOf(root.id).map((child) => ({ id: child.id, label: child.name, depth: 1 }))
      ]),
    [catalog]
  );

  const toggleExpanded = (questionId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const startSession = async (questionIds: string[]) => {
    if (!questionIds.length) {
      toast("当前筛选结果里没有可重刷的题目", { tone: "error" });
      return;
    }
    if (state.practiceSession && !state.practiceSession.completedAt) {
      const accepted = await confirm({
        title: "替换未完成的练习？",
        description: "当前有一组未完成的练习，开始错题重刷会替换它，已提交的记录仍会保留。",
        confirmText: "开始重刷",
        cancelText: "返回继续"
      });
      if (!accepted) return;
    }
    const startedAt = nowIso();
    const session: PracticeSessionState = {
      id: uid("practice"),
      mode: "wrong",
      questionIds,
      currentIndex: 0,
      answers: {},
      submitted: {},
      startedAt,
      questionStartedAt: startedAt
    };
    update((current) => ({ ...current, practiceSession: session }));
    navigate("practice", { run: "1" });
  };

  const rematch = (ids?: string[]) => {
    if (ids) {
      startSession(ids);
      return;
    }
    const source = rows.map((row) => row.question);
    const lastPracticedAt = new Map<string, string>();
    for (const record of state.records) lastPracticedAt.set(record.questionId, record.answeredAt);
    const rates = new Map<string, number>();
    for (const [key, value] of knowledgeRates) rates.set(key, value.rate);
    const picked = weightedSampleQuestions(source, Math.min(50, source.length), {
      wrongById: new Map(state.wrongs.map((wrong) => [wrong.questionId, wrong])),
      knowledgeRates: rates,
      lastPracticedAt,
      options: {
        wrongStrength: state.settings.weightedWrongStrength,
        knowledgeStrength: state.settings.weightedKnowledgeStrength
      }
    });
    startSession(picked.map((question) => question.id));
  };

  const changeStatus = async (questionId: string, next: WrongStatus) => {
    if (next === "ignored") {
      const accepted = await confirm({
        title: "忽略这道错题？",
        description: "忽略后不再出现在待复习列表，可在“已忽略”中恢复。",
        confirmText: "忽略",
        tone: "danger"
      });
      if (!accepted) return;
    }
    update((current) => updateWrongStatus(current, questionId, next));
    toast(next === "mastered" ? "已标记为掌握" : next === "ignored" ? "已忽略该错题" : "已恢复待复习", {
      tone: "success"
    });
  };

  const completion = counts.active + counts.mastered + counts.ignored
    ? counts.mastered / (counts.active + counts.mastered + counts.ignored)
    : 0;

  return (
    <section className="page wrong-page">
      <div className="page-head">
        <div className="page-head-copy">
          <p className="eyebrow">错题本</p>
          <h1>把错处，练成底气</h1>
          <p className="page-head-sub">按题库归档，结合掌握度与复习时间，集中攻克真正薄弱的地方。</p>
        </div>
      </div>

      <div className="stat-strip three">
        <StatCard label="待复习" value={counts.active} unit="题" hint={`今天到期 ${counts.due} 题`} tone="rose" icon={<Target />} />
        <StatCard label="已掌握" value={counts.mastered} unit="题" hint={`掌握率 ${Math.round(completion * 100)}%`} tone="jade" icon={<CheckCircle2 />} />
        <StatCard label="已忽略" value={counts.ignored} unit="题" hint="可随时恢复" />
      </div>

      <div className="wrong-toolbar">
        <Segmented
          ariaLabel="错题状态"
          value={status}
          onChange={(next) => setStatus(next)}
          options={statusTabs.map((tab) => ({ ...tab, badge: counts[tab.value] }))}
        />
        <div className="wrong-filters">
          <select value={bankId} onChange={(event) => setBankId(event.target.value)} aria-label="按题库筛选">
            <option value="all">全部题库</option>
            {bankOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.depth ? "　└ " : ""}
                {option.label}
              </option>
            ))}
          </select>
          <SearchField value={keyword} onChange={setKeyword} placeholder="搜索题干、知识点、标签" ariaLabel="搜索错题" />
        </div>
      </div>

      <div className="wrong-count-line">
        <span>
          {statusTabs.find((tab) => tab.value === status)?.label} · {rows.length} 题
        </span>
        <div>
          <Button variant="ghost" size="sm" icon={<RotateCcw />} onClick={() => rematch()} disabled={!rows.length}>
            重刷筛选结果
          </Button>
          <Button
            variant="quiet"
            size="sm"
            icon={<Sparkles />}
            onClick={() => navigate("practice", { mode: "wrong" })}
          >
            进入练习配置
          </Button>
        </div>
      </div>

      {rows.length ? (
        <div className="wrong-list">
          {visibleRows.map(({ wrong, question }) => {
            const isOpen = expanded.has(question.id);
            const due = wrong.status === "active" && isDue(wrong.nextReviewAt);
            const bankPath = catalog.bankPath(question.bankId).map((bank) => bank.name).join(" / ");
            return (
              <article className={cn("wrong-card", due && "is-due")} key={question.id}>
                <div className="wrong-card-head">
                  <div className="wrong-meta">
                    <TypeBadge type={question.type} />
                    <span>{bankPath}</span>
                    {due ? <span className="due-badge">今日复习</span> : null}
                  </div>
                  <span className="wrong-mastery" title={`掌握度 ${wrong.masteryLevel}/5`}>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <i key={level} className={level <= wrong.masteryLevel ? "on" : ""} />
                    ))}
                  </span>
                </div>

                <h3>{question.stem}</h3>

                <div className="wrong-stats">
                  <span>答错 {wrong.wrongCount} 次</span>
                  <span>连续答对 {wrong.correctAfterWrongCount} 次</span>
                  <span>最近 {relativeTime(wrong.lastWrongAt)}</span>
                  <span>掌握度 {wrong.masteryLevel} / 5</span>
                </div>

                <div className="wrong-progress">
                  <ProgressBar value={wrong.masteryLevel / 5} tone="jade" size="sm" label="掌握度" />
                </div>

                {isOpen ? (
                  <div className="wrong-answer">
                    <div className="wrong-answer-head">
                      <strong>正确答案</strong>
                      <span>{formatAnswer(question)}</span>
                    </div>
                    {question.options.length ? (
                      <ul className="wrong-options">
                        {question.options.map((option) => (
                          <li key={option.key} className={question.answer.includes(option.key) ? "is-correct" : ""}>
                            <b>{option.key}</b>
                            {option.text}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p>
                      <b>解析：</b>
                      {question.explanation || "暂无解析"}
                    </p>
                    {question.knowledgePoints.length ? (
                      <p className="wrong-points">知识点：{question.knowledgePoints.join(" · ")}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="wrong-actions">
                  <Button variant="ghost" size="sm" icon={isOpen ? <ChevronUp /> : <ChevronDown />} onClick={() => toggleExpanded(question.id)}>
                    {isOpen ? "收起答案" : "查看答案"}
                  </Button>
                  <Button variant="secondary" size="sm" icon={<RotateCcw />} onClick={() => rematch([question.id])}>
                    重刷此题
                  </Button>
                  {wrong.status === "active" ? (
                    <>
                      <Button variant="ghost" size="sm" icon={<CheckCircle2 />} onClick={() => void changeStatus(question.id, "mastered")}>
                        标记掌握
                      </Button>
                      <IconButton label="忽略该错题" size="sm" variant="plain" onClick={() => void changeStatus(question.id, "ignored")}>
                        <Trash2 />
                      </IconButton>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" icon={<Undo2 />} onClick={() => void changeStatus(question.id, "active")}>
                      恢复待复习
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={keyword ? <SearchX /> : status === "active" ? <Target /> : <Eye />}
          title={
            keyword
              ? "没有匹配的错题"
              : status === "active"
                ? "待复习列表已清空"
                : status === "mastered"
                  ? "还没有掌握记录"
                  : "还没有忽略的错题"
          }
          description={
            keyword
              ? "试试更短的关键词，或切换题库范围。"
              : status === "active"
                ? "完成练习后，答错的题会自动按题库归档到这里。"
                : "在待复习列表中标记掌握或忽略后，记录会出现在这里。"
          }
          action={
            status === "active" && !keyword ? (
              <Button icon={<Sparkles />} onClick={() => navigate("practice", { mode: "weighted" })}>
                开始一组智能练习
              </Button>
            ) : undefined
          }
        />
      )}

      {rows.length > visibleCount ? (
        <div className="load-more">
          <Button variant="ghost" block onClick={() => setVisibleCount((current) => current + 20)}>
            加载更多 · 还有 {rows.length - visibleCount} 题
          </Button>
        </div>
      ) : rows.length > 20 ? (
        <p className="load-more-done">已显示全部 {rows.length} 题</p>
      ) : null}
    </section>
  );
}
