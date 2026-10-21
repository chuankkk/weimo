import { useDeferredValue, useMemo, useState } from "react";
import { ChevronRight, Plus, SearchX, Upload } from "lucide-react";
import { TYPE_ORDER, typeLabel, typeTone } from "../../lib/constants";
import { computeBankProgress } from "../../lib/stats";
import { navigate } from "../../lib/router";
import { useApp } from "../../store/AppStore";
import { Button, EmptyState, ProgressBar, SearchField } from "../../components/ui";

type SortKey = "default" | "questions" | "progress" | "wrong" | "name";

const sortLabels: Record<SortKey, string> = {
  default: "默认顺序",
  questions: "题量最多",
  progress: "进度最高",
  wrong: "错题最多",
  name: "名称排序"
};

export function BankCatalog({ onOpenBank, onCreateBank }: { onOpenBank: (bankId: string) => void; onCreateBank: () => void }) {
  const { state, catalog } = useApp();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const deferred = useDeferredValue(search);

  const progress = useMemo(() => {
    const map = new Map(computeBankProgress(state, catalog).map((row) => [row.bank.id, row]));
    return map;
  }, [state, catalog]);

  const roots = useMemo(() => {
    const query = deferred.trim().toLowerCase();
    const list = catalog.roots.filter((bank) => {
      if (!query) return true;
      const children = catalog.childrenOf(bank.id);
      return [bank, ...children].some((item) => `${item.name} ${item.description}`.toLowerCase().includes(query));
    });
    if (sort === "default") return list;
    return [...list].sort((a, b) => {
      const pa = progress.get(a.id);
      const pb = progress.get(b.id);
      if (sort === "questions") return (pb?.total ?? 0) - (pa?.total ?? 0);
      if (sort === "progress") return (pb?.rate ?? 0) - (pa?.rate ?? 0);
      if (sort === "wrong") return (pb?.wrong ?? 0) - (pa?.wrong ?? 0);
      return a.name.localeCompare(b.name, "zh-CN");
    });
  }, [catalog, deferred, progress, sort]);

  return (
    <>
      <div className="catalog-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="搜索题库、章节或描述" ariaLabel="搜索题库" />
        <label className="catalog-sort">
          <span>排序</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="题库排序">
            {(Object.keys(sortLabels) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {sortLabels[key]}
              </option>
            ))}
          </select>
        </label>
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
            const row = progress.get(bank.id);
            const wrong = row?.wrong ?? 0;
            const answered = row?.answered ?? 0;
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
                  <div className="bank-card-progress">
                    <ProgressBar value={row?.rate ?? 0} size="sm" label={`${bank.name} 练习进度`} />
                    <small>
                      已练 {answered} / {total}
                    </small>
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
      <p className="catalog-footnote">提示：题库支持一级目录与子库；删除或合并都会先进入回收站，可撤销。</p>
    </>
  );
}
