import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileDown,
  FilePlus2,
  Layers3,
  Pencil,
  Plus,
  SearchX,
  Trash2
} from "lucide-react";
import type { Question, QuestionBank, QuestionType } from "../../types";
import { TYPE_ORDER, typeLabel } from "../../lib/constants";
import { relativeTime } from "../../lib/date";
import { formatAnswer } from "../../lib/text";
import { navigate } from "../../lib/router";
import { useApp } from "../../store/AppStore";
import { deleteBank, deleteQuestion } from "../../store/actions";
import {
  Button,
  Chip,
  DifficultyDots,
  EmptyState,
  IconButton,
  SearchField,
  SectionHead,
  StatCard,
  TypeBadge
} from "../../components/ui";
import { WrongBookExport } from "../../components/WrongBookExport";import { cn } from "../../lib/text";

export function BankDetail({
  bank,
  onEditBank,
  onAddChild,
  onAddQuestion,
  onEditQuestion
}: {
  bank: QuestionBank;
  onEditBank: () => void;
  onAddChild: () => void;
  onAddQuestion: (bankId: string) => void;
  onEditQuestion: (question: Question) => void;
}) {
  const { state, catalog, update, toast, confirm } = useApp();
  const children = catalog.childrenOf(bank.id);
  const [scopeId, setScopeId] = useState(bank.id);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<QuestionType | "all">("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const deferred = useDeferredValue(search);
  const pageSize = 20;

  const scopeBank = catalog.bankById.get(scopeId) ?? bank;
  const counts = catalog.typeCounts(scopeBank.id);
  const pool = catalog.pool(scopeBank.id);
  const filtered = useMemo(() => {
    const query = deferred.trim().toLowerCase();
    return pool
      .filter((question) => typeFilter === "all" || question.type === typeFilter)
      .filter((question) => {
        if (!query) return true;
        return `${question.stem} ${question.knowledgePoints.join(" ")} ${question.tags.join(" ")}`
          .toLowerCase()
          .includes(query);
      });
  }, [pool, typeFilter, deferred]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const answeredIds = useMemo(() => new Set(state.records.map((record) => record.questionId)), [state.records]);
  const answeredInScope = useMemo(() => pool.filter((question) => answeredIds.has(question.id)).length, [pool, answeredIds]);
  const answeredCount = filtered.filter((question) => answeredIds.has(question.id)).length;
  const subtree = useMemo(() => new Set(catalog.subtreeIds(bank.id)), [catalog, bank.id]);
  const wrongActive = useMemo(
    () =>
      state.wrongs.filter((wrong) => {
        if (wrong.status !== "active") return false;
        const question = catalog.questionById.get(wrong.questionId);
        return question ? subtree.has(question.bankId) || subtree.has(question.rootBankId) : false;
      }).length,
    [state.wrongs, catalog, subtree]
  );

  const selectScope = (id: string) => {
    setScopeId(id);
    setSearch("");
    setTypeFilter("all");
    setPage(1);
    setExpandedId(null);
  };

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setPage(1);
  };

  const removeBank = async () => {
    const scope = catalog.subtreeIds(bank.id);
    const questionCount = state.questions.filter((question) => scope.includes(question.bankId) || scope.includes(question.rootBankId)).length;
    const accepted = await confirm({
      title: `删除「${bank.name}」？`,
      description: `会把 ${scope.length} 个题库条目和 ${questionCount} 道题移入回收站，可在「题库 → 回收站」恢复。`,
      confirmText: "移入回收站",
      tone: "danger",
      recoverable: true
    });
    if (!accepted) return;
    update((current) => deleteBank(current, catalog, bank.id));
    toast("题库已移入回收站，可恢复", { tone: "success" });
    navigate("banks", { view: "trash" });
  };

  const removeQuestion = async (question: Question) => {
    const accepted = await confirm({
      title: "删除这道题？",
      description: "题目、相关作答记录、错题与笔记会一并删除，且无法撤销。",
      confirmText: "删除题目",
      tone: "danger"
    });
    if (!accepted) return;
    update((current) => deleteQuestion(current, question.id));
    toast("题目已删除", { tone: "success" });
  };

  const bankPath = catalog.bankPath(bank.id);
  const filtering = Boolean(search.trim()) || typeFilter !== "all";

  return (
    <section className="page bank-detail-page">
      <header className="detail-head">
        <IconButton label="返回题库目录" onClick={() => navigate("banks")}>
          <ArrowLeft />
        </IconButton>
        <div className="detail-head-copy">
          <p className="eyebrow">{bankPath.length > 1 ? bankPath.map((item) => item.name).join(" / ") : "题库详情"}</p>
          <h1>{bank.name}</h1>
          <p>{bank.description || "暂无描述"}</p>
        </div>
        <div className="detail-head-actions">
          <IconButton label="导出错题本" onClick={() => setExportOpen(true)}>
            <FileDown />
          </IconButton>
          <IconButton label="编辑题库" onClick={onEditBank}>
            <Pencil />
          </IconButton>
          <IconButton label="删除题库" onClick={() => void removeBank()}>
            <Trash2 />
          </IconButton>
        </div>
      </header>

      <div className="stat-strip three">
        <StatCard label="题目" value={catalog.totalIn(bank.id)} unit="题" hint={`${children.length} 个子库`} />
        <StatCard label="已练" value={answeredInScope} unit="题" hint={`覆盖 ${pool.length ? Math.round((answeredInScope / pool.length) * 100) : 0}%`} tone="jade" />
        <StatCard label="活跃错题" value={wrongActive} unit="题" hint="按整个题库统计" tone="rose" />
      </div>

      <div className="detail-type-row">
        {TYPE_ORDER.map((type) => (
          <span key={type} className="detail-type">
            <TypeBadge type={type} count={counts[type]} />
          </span>
        ))}
        <Button variant="ghost" size="sm" icon={<Plus />} onClick={() => onAddQuestion(scopeBank.id)}>
          新增题目
        </Button>
      </div>

      <SectionHead
        icon={<Layers3 />}
        title="子题库"
        action={
          <Button variant="quiet" size="sm" icon={<Plus />} onClick={onAddChild}>
            新增子库
          </Button>
        }
      />
      <div className="child-chip-row">
        <button
          type="button"
          className={cn("child-chip", scopeId === bank.id && "is-active")}
          onClick={() => selectScope(bank.id)}
        >
          全部
          <b>{catalog.totalIn(bank.id)}</b>
        </button>
        {children.map((child) => (
          <button
            type="button"
            key={child.id}
            className={cn("child-chip", scopeId === child.id && "is-active")}
            onClick={() => selectScope(child.id)}
          >
            <span className="bank-spine tiny" style={{ background: child.color }} aria-hidden="true" />
            {child.name}
            <b>{catalog.totalIn(child.id)}</b>
          </button>
        ))}
        {!children.length ? <span className="child-empty">还没有子库，可按章节或来源拆分。</span> : null}
      </div>

      <div className="question-toolbar">
        <SearchField
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={`在「${scopeBank.name}」中搜索题干、知识点、标签`}
          ariaLabel="搜索题目"
        />
        <div className="chip-row">
          <Chip
            active={typeFilter === "all"}
            onClick={() => {
              setTypeFilter("all");
              setPage(1);
            }}
          >
            全部题型
          </Chip>
          {TYPE_ORDER.map((type) => (
            <Chip
              key={type}
              active={typeFilter === type}
              onClick={() => {
                setTypeFilter(type);
                setPage(1);
              }}
            >
              {typeLabel[type]} {counts[type]}
            </Chip>
          ))}
        </div>
      </div>

      {filtering ? (
        <p className="filter-summary">
          筛选出 {filtered.length} 题 · 已练 {answeredCount} 题
          <button type="button" onClick={resetFilters}>
            清除筛选
          </button>
        </p>
      ) : null}

      <div className="question-index">
        {pageRows.map((question, index) => {
          const expanded = expandedId === question.id;
          const order = (currentPage - 1) * pageSize + index + 1;
          return (
            <article className={cn("question-line", expanded && "is-open")} key={question.id}>
              <button
                type="button"
                className="question-line-main"
                onClick={() => setExpandedId(expanded ? null : question.id)}
                aria-expanded={expanded}
              >
                <span className="question-order">{String(order).padStart(2, "0")}</span>
                <TypeBadge type={question.type} />
                <span className="question-line-copy">
                  <strong>{question.stem}</strong>
                  <small>
                    {question.knowledgePoints.join(" · ") || "未标知识点"}
                    {question.tags.length ? ` · ${question.tags.join(" / ")}` : ""}
                  </small>
                </span>
                <span className="question-line-state">
                  {answeredIds.has(question.id) ? <span className="answered-dot" title="已练过" /> : null}
                  {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                </span>
              </button>
              {expanded ? (
                <div className="question-expand">
                  {question.options.length ? (
                    <ul>
                      {question.options.map((option) => (
                        <li key={option.key} className={question.answer.includes(option.key) ? "is-correct" : ""}>
                          <b>{option.key}</b>
                          {option.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p>
                    <b>答案：</b>
                    {formatAnswer(question)}
                  </p>
                  <p>
                    <b>解析：</b>
                    {question.explanation || "暂无解析"}
                  </p>
                  <div className="question-expand-foot">
                    <small>
                      来源：{question.source || "未标注"} · 难度 <DifficultyDots value={question.difficulty} label /> · 更新于{" "}
                      {relativeTime(question.updatedAt)}
                    </small>
                    <div>
                      <Button variant="ghost" size="sm" icon={<Pencil />} onClick={() => onEditQuestion(question)}>
                        编辑
                      </Button>
                      <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => void removeQuestion(question)}>
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {!filtered.length ? (
        <EmptyState
          icon={search ? <SearchX /> : <BookOpen />}
          title={search ? "没有找到匹配的题目" : "这个范围还没有题目"}
          description={search ? "试试更短的关键词，或切换题型。" : "可以手动新增一道题，或从文件导入。"}
          action={
            !search ? (
              <Button icon={<FilePlus2 />} onClick={() => onAddQuestion(scopeBank.id)}>
                新增第一道题
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="pager">
          <Button variant="ghost" size="sm" icon={<ChevronLeft />} onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
            上一页
          </Button>
          <span>
            {currentPage} / {totalPages} · 共 {filtered.length} 题 · 已练 {answeredCount} 题
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage >= totalPages}
          >
            下一页 <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      )}
      <WrongBookExport open={exportOpen} onClose={() => setExportOpen(false)} bankId={bank.id} />
    </section>
  );
}
