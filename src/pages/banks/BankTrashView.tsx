import { RotateCcw, Trash2 } from "lucide-react";
import type { TrashEntry } from "../../types";
import { relativeTime } from "../../lib/date";
import { useApp } from "../../store/AppStore";
import { emptyTrash, purgeTrashEntry, restoreTrashEntry } from "../../store/actions";
import { Button, EmptyState, SectionHead } from "../../components/ui";
import { cn } from "../../lib/text";

export function BankTrashView() {
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
