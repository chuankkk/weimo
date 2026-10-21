import { useEffect, useState } from "react";
import type { QuestionBank } from "../../types";
import { BANK_COLORS } from "../../lib/constants";
import { useApp } from "../../store/AppStore";
import { upsertBank } from "../../store/actions";
import { Modal } from "../../components/overlays";
import { Button, Field, TextArea, TextInput } from "../../components/ui";
import { cn } from "../../lib/text";

export function BankFormModal({
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
    if (
      state.banks.some(
        (item) => item.id !== bank?.id && item.name.trim() === trimmed && (item.parentId ?? "") === parent
      )
    ) {
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
        {error ? (
          <div className="editor-error" role="alert">
            {error}
          </div>
        ) : null}
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
        <Field label="归属" hint={isRootWithChildren ? "该题库下已有子库，不能改为子题库" : undefined}>
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
