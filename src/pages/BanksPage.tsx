import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileDown,
  FilePlus2,
  FolderOpen,
  Layers3,
  Merge,
  Pencil,
  Plus,
  RotateCcw,
  SearchX,
  Trash2,
  Upload
} from "lucide-react";
import type { Question, QuestionBank, QuestionType, TrashEntry } from "../types";
import { BANK_COLORS, TYPE_ORDER, typeLabel, typeTone } from "../lib/constants";
import { useApp } from "../store/AppStore";
import {
  deleteBank,
  deleteQuestion,
  emptyTrash,
  mergeBanks,
  purgeTrashEntry,
  restoreTrashEntry,
  upsertBank
} from "../store/actions";
import { navigate, useRoute } from "../lib/router";
import { useDocumentTitle } from "../lib/hooks";
import { cn } from "../lib/text";
import { relativeTime } from "../lib/date";
import { DataTools } from "../components/DataTools";
import { Modal } from "../components/overlays";
import { QuestionEditor } from "../components/QuestionEditor";
import { WrongBookExport } from "../components/WrongBookExport";
import {
  Button,
  Chip,
  EmptyState,
  Field,
  IconButton,
  SearchField,
  SectionHead,
  Segmented,
  StatCard,
  TextArea,
  TextInput,
  TypeBadge
} from "../components/ui";

type BanksView = "catalog" | "import" | "merge" | "trash";

const viewOptions = [
  { value: "catalog", label: "目录", icon: <FolderOpen /> },
  { value: "import", label: "导入导出", icon: <Upload /> },
  { value: "merge", label: "合并", icon: <Merge /> },
  { value: "trash", label: "回收站", icon: <Trash2 /> }
];

export function BanksPage() {
  useDocumentTitle("题库");
  const { state, catalog } = useApp();
  const route = useRoute();
  const rawView = route.params.get("view");
  const view: BanksView = rawView === "import" || rawView === "merge" || rawView === "trash" ? rawView : "catalog";
  const activeBankId = route.params.get("bank");
  const activeBankLookup = activeBankId ? catalog.bankById.get(activeBankId) : undefined;
  const activeBank =
    activeBankLookup && !activeBankLookup.archived && !activeBankLookup.deletedAt ? activeBankLookup : undefined;
  const [createBankOpen, setCreateBankOpen] = useState(false);
  const [createChildParent, setCreateChildParent] = useState<string | undefined>();
  const [editBank, setEditBank] = useState<QuestionBank | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; bankId: string; question: Question | null }>({
    open: false,
    bankId: "",
    question: null
  });

  const totalQuestions = catalog.questions.length;

  if (activeBank) {
    return (
      <>
        <BankDetail
          key={activeBank.id}
          bank={activeBank}
          onEditBank={() => setEditBank(activeBank)}
          onAddChild={() => {
            setCreateChildParent(activeBank.id);
            setCreateBankOpen(true);
          }}
          onAddQuestion={(bankId) => setEditor({ open: true, bankId, question: null })}
          onEditQuestion={(question) => setEditor({ open: true, bankId: question.bankId, question })}
        />
        <BankFormModal
          open={createBankOpen}
          onClose={() => setCreateBankOpen(false)}
          parentId={createChildParent}
        />
        <BankFormModal open={Boolean(editBank)} onClose={() => setEditBank(null)} bank={editBank ?? undefined} />
        <QuestionEditor
          open={editor.open}
          onClose={() => setEditor((current) => ({ ...current, open: false }))}
          bankId={editor.bankId}
          question={editor.question}
        />
      </>
    );
  }

  return (
    <section className="page banks-page">
      <div className="page-head">
        <div className="page-head-copy">
          <p className="eyebrow">题库</p>
          <h1>你的知识册页</h1>
          <p className="page-head-sub">
            共 {catalog.roots.length} 个一级题库、{catalog.visibleBanks.length} 个题库、{totalQuestions} 道题。
          </p>
        </div>
        <div className="page-head-actions">
          <Button
            icon={<Plus />}
            onClick={() => {
              setCreateChildParent(undefined);
              setCreateBankOpen(true);
            }}
          >
            新建题库
          </Button>
        </div>
      </div>

      <div className="bank-subnav">
        <Segmented
          ariaLabel="题库视图"
          value={view}
          onChange={(next) => navigate("banks", next === "catalog" ? undefined : { view: next })}
          options={viewOptions.map((option) =>
            option.value === "trash" && state.trash.length ? { ...option, badge: state.trash.length } : option
          )}
        />
      </div>

      {view === "catalog" ? (
        <BankCatalog
          onOpenBank={(id) => navigate("banks", { bank: id })}
          onCreateBank={() => {
            setCreateChildParent(undefined);
            setCreateBankOpen(true);
          }}
        />
      ) : null}
      {view === "import" ? <BankImportView /> : null}
      {view === "merge" ? <BankMergeView /> : null}
      {view === "trash" ? <BankTrashView /> : null}

      <BankFormModal
        open={createBankOpen}
        onClose={() => setCreateBankOpen(false)}
        parentId={createChildParent}
      />
      <BankFormModal open={Boolean(editBank)} onClose={() => setEditBank(null)} bank={editBank ?? undefined} />
    </section>
  );
}

function BankCatalog({ onOpenBank, onCreateBank }: { onOpenBank: (bankId: string) => void; onCreateBank: () => void }) {
  const { state, catalog } = useApp();
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const roots = catalog.roots.filter((bank) => {
    const query = deferred.trim().toLowerCase();
    if (!query) return true;
    const children = catalog.childrenOf(bank.id);
    return [bank, ...children].some((item) => `${item.name} ${item.description}`.toLowerCase().includes(query));
  });

  return (
    <>
      <div className="catalog-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="搜索题库、章节或描述" ariaLabel="搜索题库" />
        <span className="catalog-count">
          {roots.length} / {catalog.roots.length} 个题库
        </span>
      </div>

      {roots.length ? (
        <div className="bank-grid">
          {roots.map((bank) => {
            const counts = catalog.typeCounts(bank.id);
            const total = catalog.totalIn(bank.id);
            const children = catalog.childrenOf(bank.id);
            const wrong = state.wrongs.filter((wrongItem) => {
              if (wrongItem.status !== "active") return false;
              const question = catalog.questionById.get(wrongItem.questionId);
              return question?.rootBankId === bank.id;
            }).length;
            return (
              <button type="button" className="bank-card" key={bank.id} onClick={() => onOpenBank(bank.id)}>
                <span className="bank-spine" style={{ background: bank.color }} aria-hidden="true" />
                <div className="bank-card-main">
                  <div className="bank-card-title">
                    <div>
                      <strong>{bank.name}</strong>
                      <p>{bank.description || "暂无描述"}</p>
                    </div>
                    <ChevronRight aria-hidden="true" />
                  </div>
                  <div className="bank-stats">
                    <span>
                      <b>{total}</b> 题
                    </span>
                    <span>
                      <b>{children.length}</b> 子库
                    </span>
                    <span className={wrong ? "is-warn" : ""}>
                      <b>{wrong}</b> 错题
                    </span>
                  </div>
                  <div className="type-bars" aria-hidden="true">
                    {TYPE_ORDER.map((type) =>
                      counts[type] ? (
                        <span
                          key={type}
                          className={`tone-${typeTone[type]}`}
                          style={{ flex: counts[type] }}
                          title={`${typeLabel[type]} ${counts[type]}`}
                        />
                      ) : null
                    )}
                    {!total ? <span className="is-empty" /> : null}
                  </div>
                  {children.length ? (
                    <div className="bank-children-preview">
                      {children.slice(0, 4).map((child) => (
                        <span key={child.id}>{child.name}</span>
                      ))}
                      {children.length > 4 ? <span>+{children.length - 4}</span> : null}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<SearchX />}
          title={search ? "没有匹配的题库" : "还没有题库"}
          description={search ? "换一个关键词试试，或清空搜索查看全部。" : "新建一个空题库，或从 Excel / CSV / JSON 导入现成题目。"}
          action={
            <div className="empty-action-row">
              <Button icon={<Plus />} onClick={onCreateBank}>
                新建题库
              </Button>
              <Button variant="secondary" icon={<Upload />} onClick={() => navigate("banks", { view: "import" })}>
                导入题库
              </Button>
            </div>
          }
        />
      )}
    </>
  );
}

function BankImportView() {
  const { state, catalog } = useApp();
  return (
    <>
      <SectionHead icon={<Upload />} title="导入与导出" hint="Excel / CSV / JSON 均可在本地完成，不上传服务器" />
      <div className="import-summary">
        <StatCard label="题库" value={catalog.visibleBanks.length} unit="个" hint={`${catalog.roots.length} 个一级题库`} />
        <StatCard label="题目" value={state.questions.length} unit="题" tone="jade" />
        <StatCard label="学习记录" value={state.records.length} unit="次" tone="gold" />
      </div>
      <DataTools />
      <section className="card help-card">
        <h3>导入字段说明</h3>
        <ul>
          <li>
            <b>大题库 / 小题库</b>：自动创建目录；小题库留空时题目挂在一级题库下。
          </li>
          <li>
            <b>题型</b>：单选、多选、判断、填空；也可写 single / multiple / judge / fill。
          </li>
          <li>
            <b>答案</b>：多选用逗号分隔；判断题写“对 / 错”；填空多空用英文分号分隔。
          </li>
          <li>
            <b>可接受答案</b>：按空用分号分隔，同一空多个答案用竖线分隔，例如“北京|北京市”。
          </li>
          <li>完整 JSON 备份导入时会提示覆盖当前全部数据，可用于迁移设备。</li>
        </ul>
      </section>
    </>
  );
}

function BankMergeView() {
  const { state, catalog, update, toast, confirm } = useApp();
  const [fromId, setFromId] = useState(catalog.visibleBanks[0]?.id ?? "");
  const [toId, setToId] = useState(catalog.visibleBanks[1]?.id ?? catalog.visibleBanks[0]?.id ?? "");

  useEffect(() => {
    if (!catalog.bankById.has(fromId)) setFromId(catalog.visibleBanks[0]?.id ?? "");
    if (!catalog.bankById.has(toId)) setToId(catalog.visibleBanks[0]?.id ?? "");
  }, [catalog, fromId, toId]);

  const fromBank = catalog.bankById.get(fromId);
  const toBank = catalog.bankById.get(toId);
  const fromScope = fromId ? catalog.subtreeIds(fromId) : [];
  const invalidTarget = Boolean(fromId && toId && fromScope.includes(toId));
  const count = state.questions.filter((question) => fromScope.includes(question.bankId) || fromScope.includes(question.rootBankId)).length;
  const canMerge = Boolean(fromId && toId && fromId !== toId && !invalidTarget && count > 0);

  const runMerge = async () => {
    if (!canMerge || !fromBank || !toBank) return;
    const accepted = await confirm({
      title: "合并题库？",
      description: `将「${fromBank.name}」下的 ${count} 道题移动到「${toBank.name}」，来源题库会进入回收站，可在那里撤销合并。`,
      confirmText: "开始合并",
      tone: "danger",
      recoverable: true
    });
    if (!accepted) return;
    update((current) => mergeBanks(current, catalog, fromId, toId));
    toast(`已合并 ${count} 道题到「${toBank.name}」，可在回收站恢复`, { tone: "success" });
    navigate("banks", { view: "trash" });
  };

  const bankOptions = catalog.roots.flatMap((root) => [
    { id: root.id, label: root.name, depth: 0 },
    ...catalog.childrenOf(root.id).map((child) => ({ id: child.id, label: child.name, depth: 1 }))
  ]);

  return (
    <>
      <SectionHead icon={<Merge />} title="合并题库" hint="把来源题库的题目整体移动到目标题库" />
      <div className="merge-card card">
        <div className="merge-columns">
          <Field label="来源题库">
            <select value={fromId} onChange={(event) => setFromId(event.target.value)}>
              {bankOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.depth ? "　└ " : ""}
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <span className="merge-arrow" aria-hidden="true">
            <ChevronRight />
          </span>
          <Field label="合并到">
            <select value={toId} onChange={(event) => setToId(event.target.value)}>
              {bankOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.depth ? "　└ " : ""}
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {fromBank && toBank && fromId !== toId && !invalidTarget ? (
          <div className="merge-preview">
            <div>
              <span>来源</span>
              <strong>{fromBank.name}</strong>
              <small>{count} 道题 · {fromScope.length} 个题库条目</small>
            </div>
            <ChevronRight aria-hidden="true" />
            <div>
              <span>目标</span>
              <strong>{toBank.name}</strong>
              <small>{catalog.totalIn(toBank.id)} 道题</small>
            </div>
          </div>
        ) : (
          <p className="merge-hint">
            {invalidTarget ? "不能把题库合并到自己的子题库，请选择另一个目标。" : "请选择两个不同的题库。"}
          </p>
        )}

        <Button icon={<Merge />} onClick={() => void runMerge()} disabled={!canMerge}>
          确认合并
        </Button>
        <p className="field-hint">合并不会删除历史练习与错题记录；来源题库会进入回收站，可撤销合并。</p>
      </div>
    </>
  );
}

function BankTrashView() {
  const { state, update, toast, confirm } = useApp();
  const entries = state.trash;

  const restore = (entry: TrashEntry) => {
    update((current) => restoreTrashEntry(current, entry.id));
    toast(entry.kind === "merge" ? "已撤销合并" : "题库已恢复", { tone: "success" });
  };

  const purge = async (entry: TrashEntry) => {
    const accepted = await confirm({
      title: entry.kind === "merge" ? "彻底删除合并归档？" : "彻底删除题库？",
      description:
        entry.kind === "merge"
          ? `会删除「${entry.bankName}」的归档条目，但不会删除目标题库中已经合并的题目。`
          : `「${entry.bankName}」下的 ${entry.questionCount} 道题、作答记录、错题和笔记都会永久删除，无法恢复。`,
      confirmText: "彻底删除",
      tone: "danger"
    });
    if (!accepted) return;
    update((current) => purgeTrashEntry(current, entry.id));
    toast("已彻底删除", { tone: "success" });
  };

  const clear = async () => {
    const accepted = await confirm({
      title: "清空回收站？",
      description: "所有已删除的题库、题目记录和合并归档都会被永久删除，无法恢复。",
      confirmText: "清空回收站",
      tone: "danger"
    });
    if (!accepted) return;
    update((current) => emptyTrash(current));
    toast("回收站已清空", { tone: "success" });
  };

  return (
    <>
      <SectionHead
        icon={<Trash2 />}
        title="回收站"
        hint="删除的题库和合并操作都可以在这里恢复"
        action={
          entries.length ? (
            <Button variant="quiet" size="sm" icon={<Trash2 />} onClick={() => void clear()}>
              清空回收站
            </Button>
          ) : undefined
        }
      />
      {entries.length ? (
        <div className="trash-list">
          {entries.map((entry) => (
            <article className="trash-card card" key={entry.id}>
              <span className={cn("trash-kind", entry.kind === "merge" ? "is-merge" : "is-bank")}>
                {entry.kind === "merge" ? "合并" : "删除"}
              </span>
              <div className="trash-copy">
                <strong>{entry.bankName}</strong>
                <p>
                  {entry.kind === "merge"
                    ? `已合并到「${entry.targetBankName || "未知题库"}」 · ${entry.questionCount} 道题`
                    : `${entry.bankCount} 个题库条目 · ${entry.questionCount} 道题`}
                </p>
                <small>{relativeTime(entry.createdAt)}</small>
              </div>
              <div className="trash-actions">
                <Button size="sm" icon={<RotateCcw />} onClick={() => restore(entry)}>
                  {entry.kind === "merge" ? "撤销合并" : "恢复题库"}
                </Button>
                <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => void purge(entry)}>
                  彻底删除
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Trash2 />}
          title="回收站是空的"
          description="删除的题库会先保留在这里，合并操作也可以撤销；需要时随时恢复。"
        />
      )}
    </>
  );
}

function BankDetail({
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
  const answeredCount = filtered.filter((question) => answeredIds.has(question.id)).length;
  const subtree = useMemo(() => catalog.subtreeIds(bank.id), [catalog, bank.id]);
  const wrongActive = state.wrongs.filter((wrong) => {
    if (wrong.status !== "active") return false;
    const question = catalog.questionById.get(wrong.questionId);
    return question ? subtree.includes(question.bankId) || subtree.includes(question.rootBankId) : false;
  }).length;

  const selectScope = (id: string) => {
    setScopeId(id);
    setSearch("");
    setTypeFilter("all");
    setPage(1);
    setExpandedId(null);
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
      description: "题目、相关作答记录、错题与笔记会一并删除。",
      confirmText: "删除题目",
      tone: "danger"
    });
    if (!accepted) return;
    update((current) => deleteQuestion(current, question.id));
    toast("题目已删除", { tone: "success" });
  };

  const bankPath = catalog.bankPath(bank.id);
  const wrongScopeCount = wrongActive;

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
        <StatCard label="已练" value={answeredCount} unit="题" hint={filtered.length ? `当前筛选 ${filtered.length} 题` : "尚未筛选"} tone="jade" />
        <StatCard label="活跃错题" value={wrongScopeCount} unit="题" hint="按整个题库统计" tone="rose" />
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
                    {question.type === "judge"
                      ? question.answer[0] === "true"
                        ? "正确"
                        : "错误"
                      : question.answer.join("、")}
                  </p>
                  <p>
                    <b>解析：</b>
                    {question.explanation || "暂无解析"}
                  </p>
                  <div className="question-expand-foot">
                    <small>来源：{question.source || "未标注"} · 难度 {question.difficulty}/5</small>
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

function BankFormModal({
  open,
  onClose,
  bank,
  parentId
}: {
  open: boolean;
  onClose: () => void;
  bank?: QuestionBank;
  parentId?: string;
}) {
  const { state, catalog, update, toast } = useApp();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState("");
  const [color, setColor] = useState(BANK_COLORS[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(bank?.name ?? "");
    setDescription(bank?.description ?? "");
    setParent(bank?.parentId ?? parentId ?? "");
    setColor(bank?.color ?? BANK_COLORS[0]);
    setError("");
  }, [open, bank, parentId]);

  const isRootWithChildren = Boolean(bank && !bank.parentId && catalog.childrenOf(bank.id).length);
  const parentOptions = catalog.roots.filter((root) => root.id !== bank?.id && !isRootWithChildren);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请填写题库名称");
      return;
    }
    if (state.banks.some((item) => item.id !== bank?.id && item.name.trim() === trimmed && (item.parentId ?? "") === parent)) {
      setError("同级下已有同名题库");
      return;
    }
    update((current) =>
      upsertBank(
        current,
        {
          name: trimmed,
          description: description.trim(),
          parentId: parent || undefined,
          color
        },
        bank?.id
      )
    );
    toast(bank ? "题库已更新" : parent ? "子题库已创建" : "题库已创建", { tone: "success" });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bank ? "编辑题库" : parentId ? "新建子题库" : "新建题库"}
      description={bank ? "名称、说明与书脊颜色会立即更新。" : "先建立目录，再录入或导入题目。"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>{bank ? "保存修改" : "创建题库"}</Button>
        </>
      }
    >
      <div className="editor-form">
        {error ? <div className="editor-error" role="alert">{error}</div> : null}
        <Field label="题库名称">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：2026 事业单位公共基础" />
        </Field>
        <Field label="说明">
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="范围、年份、来源或复习阶段"
            rows={3}
          />
        </Field>
        <Field
          label="归属"
          hint={isRootWithChildren ? "该题库下已有子库，不能改为子题库" : undefined}
        >
          <select value={parent} onChange={(event) => setParent(event.target.value)} disabled={isRootWithChildren}>
            <option value="">作为一级题库</option>
            {parentOptions.map((root) => (
              <option key={root.id} value={root.id}>
                {root.name} 的子库
              </option>
            ))}
          </select>
        </Field>
        <Field label="书脊颜色">
          <div className="swatches">
            {BANK_COLORS.map((item) => (
              <button
                key={item}
                type="button"
                className={cn("swatch", color === item && "is-active")}
                style={{ background: item }}
                onClick={() => setColor(item)}
                aria-label={`选择颜色 ${item}`}
                aria-pressed={color === item}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
