import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, CheckCircle2, Lightbulb, NotebookPen, Save, X, XCircle } from "lucide-react";
import type { Question, QuestionEvaluation } from "../types";
import { countBlanks, formatAnswer, formatUserAnswer, normalizeAnswerToken, resolveBlankCount, cn } from "../lib/text";
import { useApp } from "../store/AppStore";
import { Button, Chip, DifficultyDots, TypeBadge } from "./ui";
import { relativeTime } from "../lib/date";

const TRUE_KEY = "true";
const FALSE_KEY = "false";

const isBlankToken = (part: string) => /^[_＿]{2,}$/.test(part);

const StemText = ({ stem }: { stem: string }) => {
  const parts = useMemo(() => stem.split(/([_＿]{2,})/g), [stem]);
  if (parts.length === 1) return <>{stem}</>;
  return (
    <>
      {parts.map((part, index) =>
        isBlankToken(part) ? (
          <span className="stem-blank" key={`blank-${index}`} aria-label="填空">
            {part}
          </span>
        ) : (
          <span key={`text-${index}`}>{part}</span>
        )
      )}
    </>
  );
};

export interface QuestionCardProps {
  question: Question;
  answer: string[];
  submitted?: boolean;
  evaluation?: QuestionEvaluation | null;
  onAnswer?: (answer: string[]) => void;
  bankLabel?: string;
  compactMeta?: boolean;
  children?: ReactNode;
}

export function QuestionCard({
  question,
  answer,
  submitted = false,
  evaluation,
  onAnswer,
  bankLabel,
  compactMeta = false,
  children
}: QuestionCardProps) {
  const locked = submitted || !onAnswer;
  const normalizedAnswer = useMemo(
    () => (evaluation?.normalizedAnswer ?? question.answer.map(normalizeAnswerToken).filter(Boolean)),
    [evaluation, question.answer]
  );
  const correctKeys = useMemo(() => new Set(normalizedAnswer), [normalizedAnswer]);
  const selectedKeys = useMemo(() => new Set(answer.map(normalizeAnswerToken).filter(Boolean)), [answer]);

  const toggleOption = (key: string) => {
    if (locked || !onAnswer) return;
    if (question.type === "multiple") {
      onAnswer(answer.includes(key) ? answer.filter((item) => item !== key) : [...answer, key]);
      return;
    }
    onAnswer([key]);
  };

  const optionClass = (key: string) => {
    const selected = selectedKeys.has(normalizeAnswerToken(key));
    const correct = correctKeys.has(normalizeAnswerToken(key));
    return cn(
      "option",
      question.type === "multiple" && "option-multi",
      selected && "is-selected",
      submitted && correct && "is-correct",
      submitted && selected && !correct && "is-wrong"
    );
  };

  const renderOptionMark = (key: string) => {
    const normalized = normalizeAnswerToken(key);
    if (submitted && correctKeys.has(normalized)) {
      return <Check aria-hidden="true" />;
    }
    if (submitted && selectedKeys.has(normalized) && !correctKeys.has(normalized)) {
      return <X aria-hidden="true" />;
    }
    return <span>{key}</span>;
  };

  return (
    <article className={cn("question-card", compactMeta && "is-compact")} data-question-id={question.id}>
      <div className="question-meta">
        <TypeBadge type={question.type} />
        <DifficultyDots value={question.difficulty} />
        {bankLabel ? <span className="question-bank">{bankLabel}</span> : null}
        {question.source ? <span className="question-source">{question.source}</span> : null}
      </div>

      <h2 className="question-stem">
        <StemText stem={question.stem} />
      </h2>

      {question.knowledgePoints.length ? (
        <div className="question-points">
          {question.knowledgePoints.slice(0, 4).map((point) => (
            <Chip key={point}>{point}</Chip>
          ))}
        </div>
      ) : null}

      {question.type === "single" || question.type === "multiple" ? (
        <div className="option-list" role="group" aria-label="选项">
          {question.options.map((option) => (
            <button
              key={option.key}
              type="button"
              className={optionClass(option.key)}
              onClick={() => toggleOption(option.key)}
              disabled={locked}
              aria-pressed={selectedKeys.has(normalizeAnswerToken(option.key))}
            >
              <span className="option-key">{renderOptionMark(option.key)}</span>
              <span className="option-text">{option.text}</span>
            </button>
          ))}
        </div>
      ) : null}

      {question.type === "judge" ? (
        <div className="judge-row">
          {[
            { key: TRUE_KEY, label: "正确", icon: <CheckCircle2 aria-hidden="true" /> },
            { key: FALSE_KEY, label: "错误", icon: <XCircle aria-hidden="true" /> }
          ].map((item) => {
            const selected = selectedKeys.has(item.key);
            const correct = correctKeys.has(item.key);
            return (
              <button
                key={item.key}
                type="button"
                className={cn(
                  "option option-judge",
                  selected && "is-selected",
                  submitted && correct && "is-correct",
                  submitted && selected && !correct && "is-wrong"
                )}
                onClick={() => toggleOption(item.key)}
                disabled={locked}
                aria-pressed={selected}
              >
                <span className="judge-symbol">{item.icon}</span>
                <strong>{item.label}</strong>
                {submitted && correct ? <span className="judge-flag">正确答案</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {question.type === "fill" ? (
        <FillAnswer
          question={question}
          answer={answer}
          submitted={submitted}
          evaluation={evaluation}
          onAnswer={onAnswer}
        />
      ) : null}

      {question.type === "multiple" && !submitted ? (
        <p className="question-hint">多选题，请选择所有符合条件的选项。</p>
      ) : null}
      {question.type === "fill" && !submitted ? (
        <p className="question-hint">
          共 {Math.max(1, resolveBlankCount(question))} 个空，按顺序填写；系统会忽略首尾空格与全半角差异。
        </p>
      ) : null}
      {children}
    </article>
  );
}

function FillAnswer({
  question,
  answer,
  submitted,
  evaluation,
  onAnswer
}: {
  question: Question;
  answer: string[];
  submitted: boolean;
  evaluation?: QuestionEvaluation | null;
  onAnswer?: (answer: string[]) => void;
}) {
  const blankCount = Math.max(resolveBlankCount(question), countBlanks(question.stem), 1);
  const normalizedExpected = evaluation?.normalizedAnswer ?? question.answer.map(normalizeAnswerToken).filter(Boolean);
  const normalizedUser = evaluation?.normalizedUserAnswer ?? answer.map(normalizeAnswerToken).filter(Boolean);

  const setBlank = (index: number, value: string) => {
    if (!onAnswer) return;
    const next = Array.from({ length: blankCount }, (_, position) => answer[position] ?? "");
    next[index] = value;
    onAnswer(next);
  };

  return (
    <div className="fill-grid">
      {Array.from({ length: blankCount }, (_, index) => {
        const value = answer[index] ?? "";
        const hasValue = Boolean(normalizeAnswerToken(value));
        const isCorrect = submitted && hasValue && normalizedUser[index] === normalizedExpected[index];
        const isWrong = submitted && (!hasValue || normalizedUser[index] !== normalizedExpected[index]);
        return (
          <label className={cn("fill-field", isCorrect && "is-correct", isWrong && "is-wrong")} key={index}>
            <span className="fill-label">
              第 {index + 1} 空
              {submitted ? (
                isCorrect ? <Check aria-hidden="true" /> : <X aria-hidden="true" />
              ) : null}
            </span>
            <input
              value={value}
              onChange={(event) => setBlank(index, event.target.value)}
              placeholder={`填写第 ${index + 1} 空的答案`}
              disabled={submitted}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </label>
        );
      })}
    </div>
  );
}

export function AnswerPanel({
  question,
  evaluation,
  userAnswer,
  compact = false
}: {
  question: Question;
  evaluation: QuestionEvaluation;
  userAnswer: string[];
  compact?: boolean;
}) {
  const correct = evaluation.isCorrect;
  return (
    <section className={cn("answer-panel", correct ? "is-correct" : "is-wrong", compact && "is-compact")} aria-live="polite">
      <header className="answer-head">
        <span className="answer-icon">{correct ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}</span>
        <div>
          <strong>{correct ? "回答正确" : "需要再练"}</strong>
          <p>{evaluation.detail}</p>
        </div>
        <span className="answer-seal" aria-hidden="true">
          {correct ? "对" : "误"}
        </span>
      </header>

      <dl className="answer-rows">
        <div>
          <dt>正确答案</dt>
          <dd>{formatAnswer(question)}</dd>
        </div>
        {!correct ? (
          <div>
            <dt>你的答案</dt>
            <dd className="is-muted">{formatUserAnswer(question, userAnswer)}</dd>
          </div>
        ) : null}
        <div className="answer-explanation">
          <dt>
            <Lightbulb aria-hidden="true" /> 解析
          </dt>
          <dd>{question.explanation || "暂无解析，可在题库中补充。"}</dd>
        </div>
      </dl>

      {question.tags.length ? (
        <div className="answer-tags">
          {question.tags.map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function NoteEditor({ questionId }: { questionId: string }) {
  const { state, update, toast } = useApp();
  const note = state.notes.find((item) => item.questionId === questionId);
  const [draft, setDraft] = useState(note?.content ?? "");
  const [savedAt, setSavedAt] = useState(note?.updatedAt ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(note?.content ?? "");
    setSavedAt(note?.updatedAt ?? "");
    setDirty(false);
  }, [questionId, note?.content, note?.updatedAt]);

  const save = () => {
    const content = draft.trim();
    const now = new Date().toISOString();
    update((current) => {
      const others = current.notes.filter((item) => item.questionId !== questionId);
      if (!content) return { ...current, notes: others };
      const existing = current.notes.find((item) => item.questionId === questionId);
      return {
        ...current,
        notes: [
          ...others,
          {
            id: existing?.id ?? `note-${Date.now().toString(36)}`,
            questionId,
            content,
            updatedAt: now
          }
        ]
      };
    });
    setSavedAt(content ? now : "");
    setDirty(false);
    toast(content ? "笔记已保存" : "笔记已清空", { tone: "success" });
  };

  return (
    <section className="note-card">
      <div className="note-head">
        <span className="note-title">
          <NotebookPen aria-hidden="true" />
          我的笔记
        </span>
        {savedAt ? <small className="note-saved">上次保存 {relativeTime(savedAt)}</small> : null}
      </div>
      <textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setDirty(true);
        }}
        placeholder="写下易错点、口诀或解法，下次会自动带出。"
        aria-label="题目笔记"
        rows={4}
      />
      <div className="note-foot">
        <span>{draft.trim().length} 字{dirty ? " · 未保存" : ""}</span>
        <Button size="sm" variant="secondary" icon={<Save />} onClick={save} disabled={!dirty}>
          保存笔记
        </Button>
      </div>
    </section>
  );
}
