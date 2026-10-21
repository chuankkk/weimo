import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import type { Question, QuestionOption, QuestionType } from "../types";
import { TYPE_ORDER, typeLabel } from "../lib/constants";
import { countBlanks, parseAliasesText, splitList } from "../lib/text";
import { useApp } from "../store/AppStore";
import { upsertQuestion, type QuestionDraft } from "../store/actions";
import { Modal } from "./overlays";
import { Button, Field, TextArea, TextInput, TypeBadge } from "./ui";

const OPTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const blankOptions = (count = 4): QuestionOption[] =>
  OPTION_KEYS.slice(0, count).map((key) => ({ key, text: "" }));

const defaultOptions = () => blankOptions(4);

export interface QuestionEditorProps {
  open: boolean;
  onClose: () => void;
  bankId: string;
  question?: Question | null;
}

export function QuestionEditor({ open, onClose, bankId, question }: QuestionEditorProps) {
  const { state, catalog, update, toast } = useApp();
  const [type, setType] = useState<QuestionType>(question?.type ?? "single");
  const [stem, setStem] = useState(question?.stem ?? "");
  const [options, setOptions] = useState<QuestionOption[]>(question?.options.length ? question.options : defaultOptions());
  const [answer, setAnswer] = useState<string[]>(question?.answer ?? []);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [knowledge, setKnowledge] = useState(question?.knowledgePoints.join("、") ?? "");
  const [tags, setTags] = useState(question?.tags.join("、") ?? "");
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? 2);
  const [source, setSource] = useState(question?.source ?? "手动录入");
  const [aliases, setAliases] = useState(question?.answerAliases.map((item) => item.join("|")).join(";") ?? "");
  const [targetBankId, setTargetBankId] = useState(question?.bankId ?? bankId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setType(question?.type ?? "single");
    setStem(question?.stem ?? "");
    setOptions(question?.options.length ? question.options : defaultOptions());
    setAnswer(question?.answer ?? []);
    setExplanation(question?.explanation ?? "");
    setKnowledge(question?.knowledgePoints.join("、") ?? "");
    setTags(question?.tags.join("、") ?? "");
    setDifficulty(question?.difficulty ?? 2);
    setSource(question?.source ?? "手动录入");
    setAliases(question?.answerAliases.map((item) => item.join("|")).join(";") ?? "");
    setTargetBankId(question?.bankId ?? bankId);
    setError("");
  }, [open, question, bankId]);

  const blankCount = useMemo(() => Math.max(countBlanks(stem), answer.length, 1), [stem, answer.length]);

  const changeType = (next: QuestionType) => {
    setType(next);
    setError("");
    if (next === "judge") {
      setAnswer(["true"]);
      return;
    }
    if (next === "fill") {
      setAnswer(Array.from({ length: Math.max(1, countBlanks(stem)) }, () => ""));
      return;
    }
    setOptions((current) => (current.length >= 2 ? current : defaultOptions()));
    setAnswer((current) => current.filter((key) => OPTION_KEYS.slice(0, Math.max(2, options.length)).includes(key)));
  };

  const addOption = () => {
    if (options.length >= OPTION_KEYS.length) return;
    setOptions([...options, { key: OPTION_KEYS[options.length], text: "" }]);
  };

  const removeOption = () => {
    if (options.length <= 2) return;
    const removedKey = options[options.length - 1].key;
    setOptions(options.slice(0, -1));
    setAnswer((current) => current.filter((key) => key !== removedKey));
  };

  const toggleAnswer = (key: string) => {
    if (type === "single") {
      setAnswer([key]);
      return;
    }
    setAnswer((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const save = () => {
    const trimmedStem = stem.trim();
    if (!trimmedStem) {
      setError("请填写题干");
      return;
    }
    const bank = state.banks.find((item) => item.id === targetBankId);
    if (!bank) {
      setError("请选择所属题库");
      return;
    }

    let finalOptions: QuestionOption[] = [];
    let finalAnswer = answer.map((item) => item.trim()).filter(Boolean);
    if (type === "single" || type === "multiple") {
      finalOptions = options.map((option) => ({ key: option.key, text: option.text.trim() }));
      if (finalOptions.some((option) => !option.text)) {
        setError("请补全所有选项内容，或删除多余的空白选项");
        return;
      }
      if (!finalAnswer.length) {
        setError(type === "single" ? "请选择一个正确答案" : "请至少选择一个正确答案");
        return;
      }
      if (finalAnswer.some((key) => !finalOptions.some((option) => option.key === key))) {
        setError("答案中包含不存在的选项");
        return;
      }
      if (type === "single" && finalAnswer.length > 1) {
        setError("单选题只能有一个正确答案");
        return;
      }
    }
    if (type === "judge") {
      finalAnswer = [answer[0] === "false" ? "false" : "true"];
    }
    if (type === "fill") {
      finalAnswer = Array.from({ length: blankCount }, (_, index) => (answer[index] ?? "").trim());
      if (finalAnswer.some((item) => !item)) {
        setError("请填写每一个空的答案；如题干空数有误，请先调整题干中的下划线");
        return;
      }
    }

    const draft: QuestionDraft = {
      id: question?.id,
      bankId: targetBankId,
      type,
      stem: trimmedStem,
      options: finalOptions,
      answer: finalAnswer,
      answerAliases: type === "fill" ? parseAliasesText(aliases) : [],
      explanation: explanation.trim(),
      knowledgePoints: splitList(knowledge),
      tags: splitList(tags),
      difficulty,
      source: source.trim() || "手动录入"
    };

    update((current) => upsertQuestion(current, draft));
    toast(question ? "题目已更新" : "题目已添加", { tone: "success" });
    onClose();
  };

  const bankOptions = catalog.roots.flatMap((root) => [
    { id: root.id, label: root.name, depth: 0 },
    ...catalog.childrenOf(root.id).map((child) => ({ id: child.id, label: child.name, depth: 1 }))
  ]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={question ? "编辑题目" : "新增题目"}
      description={question ? "修改后立即生效，已有作答记录会保留。" : "题目会添加到当前题库，可随时再编辑。"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>{question ? "保存修改" : "添加题目"}</Button>
        </>
      }
    >
      <div className="editor-form">
        {error ? <div className="editor-error" role="alert">{error}</div> : null}

        <div className="editor-grid two">
          <Field label="所属题库">
            <select value={targetBankId} onChange={(event) => setTargetBankId(event.target.value)}>
              {bankOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.depth ? "　└ " : ""}
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="难度">
            <select value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))}>
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  {level} 级 · {["入门", "基础", "进阶", "较难", "挑战"][level - 1]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="题型">
          <div className="type-picker">
            {TYPE_ORDER.map((item) => (
              <button
                key={item}
                type="button"
                className={`type-pick ${type === item ? "is-active" : ""}`}
                onClick={() => changeType(item)}
                aria-pressed={type === item}
                aria-label={`切换到${typeLabel[item]}`}
              >
                <TypeBadge type={item} />
                {type === item ? <Check aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </Field>

        <Field label="题干" hint="用连续下划线表示填空，例如：____">
          <TextArea
            value={stem}
            onChange={(event) => setStem(event.target.value)}
            placeholder="输入题目内容"
            rows={3}
          />
        </Field>

        {type === "single" || type === "multiple" ? (
          <div className="editor-options">
            <div className="editor-label-row">
              <span>选项</span>
              <small>点击左侧字母设置正确答案</small>
            </div>
            {options.map((option, index) => (
              <div className="editor-option" key={option.key}>
                <button
                  type="button"
                  className={`option-key-btn ${answer.includes(option.key) ? "is-answer" : ""}`}
                  onClick={() => toggleAnswer(option.key)}
                  aria-pressed={answer.includes(option.key)}
                  aria-label={`将 ${option.key} 设为正确答案`}
                >
                  {option.key}
                </button>
                <input
                  value={option.text}
                  onChange={(event) => {
                    const next = [...options];
                    next[index] = { ...option, text: event.target.value };
                    setOptions(next);
                  }}
                  placeholder={`选项 ${option.key} 的内容`}
                  aria-label={`选项 ${option.key}`}
                />
                {index === options.length - 1 && options.length > 2 ? (
                  <button type="button" className="editor-remove" onClick={removeOption} aria-label="删除最后一个选项">
                    <Trash2 />
                  </button>
                ) : null}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus />}
              onClick={addOption}
              disabled={options.length >= OPTION_KEYS.length}
            >
              添加选项
            </Button>
          </div>
        ) : null}

        {type === "judge" ? (
          <Field label="正确答案">
            <div className="judge-picker">
              <button
                type="button"
                className={answer[0] !== "false" ? "is-active" : ""}
                onClick={() => setAnswer(["true"])}
              >
                正确
              </button>
              <button
                type="button"
                className={answer[0] === "false" ? "is-active" : ""}
                onClick={() => setAnswer(["false"])}
              >
                错误
              </button>
            </div>
          </Field>
        ) : null}

        {type === "fill" ? (
          <>
            <Field label="答案" hint={`按题干识别到 ${blankCount} 个空`}>
              <div className="fill-editor">
                {Array.from({ length: blankCount }, (_, index) => (
                  <label key={index}>
                    <span>第 {index + 1} 空</span>
                    <input
                      value={answer[index] ?? ""}
                      onChange={(event) => {
                        const next = Array.from({ length: blankCount }, (_, position) => answer[position] ?? "");
                        next[index] = event.target.value;
                        setAnswer(next);
                      }}
                      placeholder={`第 ${index + 1} 空的标准答案`}
                    />
                  </label>
                ))}
              </div>
            </Field>
            <Field label="可接受答案" hint="按空用英文分号分隔，同一空多个答案用竖线分隔">
              <TextInput
                value={aliases}
                onChange={(event) => setAliases(event.target.value)}
                placeholder="例如：多此一举|做多余的事;另一空的等价答案"
              />
            </Field>
          </>
        ) : null}

        <Field label="解析" hint="建议写清解题思路与易错点">
          <TextArea value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={3} placeholder="输入答案解析" />
        </Field>

        <div className="editor-grid two">
          <Field label="知识点" hint="用顿号或逗号分隔">
            <TextInput value={knowledge} onChange={(event) => setKnowledge(event.target.value)} placeholder="病句辨析、言语理解" />
          </Field>
          <Field label="标签" hint="用顿号或逗号分隔">
            <TextInput value={tags} onChange={(event) => setTags(event.target.value)} placeholder="语病、高频" />
          </Field>
        </div>

        <Field label="来源">
          <TextInput value={source} onChange={(event) => setSource(event.target.value)} placeholder="例如：2026 事业单位真题" />
        </Field>
      </div>
    </Modal>
  );
}
