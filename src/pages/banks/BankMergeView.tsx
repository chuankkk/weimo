import { useEffect, useState } from "react";
import { ChevronRight, Merge } from "lucide-react";
import { useApp } from "../../store/AppStore";
import { mergeBanks } from "../../store/actions";
import { navigate } from "../../lib/router";
import { Button, Field, SectionHead } from "../../components/ui";

export function BankMergeView() {
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
          <div className="merge-preview" aria-live="polite">
            <div>
              <span>来源</span>
              <strong>{fromBank.name}</strong>
              <small>
                {count} 道题 · {fromScope.length} 个题库条目
              </small>
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
