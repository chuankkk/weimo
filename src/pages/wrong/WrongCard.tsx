import { CheckCircle2, ChevronDown, ChevronUp, RotateCcw, Trash2, Undo2 } from "lucide-react";
import type { WrongRow, WrongStatus } from "../../types";
import { formatAnswer } from "../../lib/text";
import { isDue, relativeTime } from "../../lib/date";
import { useApp } from "../../store/AppStore";
import { Button, IconButton, ProgressBar, TypeBadge } from "../../components/ui";
import { cn } from "../../lib/text";

export function WrongCard({
  row,
  expanded,
  onToggle,
  onRematch,
  onStatus
}: {
  row: WrongRow;
  expanded: boolean;
  onToggle: () => void;
  onRematch: () => void;
  onStatus: (status: WrongStatus) => void;
}) {
  const { catalog } = useApp();
  const { wrong, question } = row;
  const due = wrong.status === "active" && isDue(wrong.nextReviewAt);
  const bankPath = catalog.bankPath(question.bankId).map((bank) => bank.name).join(" / ");

  return (
    <article className={cn("wrong-card", due && "is-due")}>
      <div className="wrong-card-head">
        <div className="wrong-meta">
          <TypeBadge type={question.type} />
          <span>{bankPath}</span>
          {due ? <span className="due-badge">今日复习</span> : null}
        </div>
        <span className="wrong-mastery" title={`掌握度 ${wrong.masteryLevel}/5`} aria-label={`掌握度 ${wrong.masteryLevel} / 5`}>
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

      {expanded ? (
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
        <Button variant="ghost" size="sm" icon={expanded ? <ChevronUp /> : <ChevronDown />} onClick={onToggle}>
          {expanded ? "收起答案" : "查看答案"}
        </Button>
        <Button variant="secondary" size="sm" icon={<RotateCcw />} onClick={onRematch}>
          重刷此题
        </Button>
        {wrong.status === "active" ? (
          <>
            <Button variant="ghost" size="sm" icon={<CheckCircle2 />} onClick={() => onStatus("mastered")}>
              标记掌握
            </Button>
            <IconButton label="忽略该错题" size="sm" variant="plain" onClick={() => onStatus("ignored")}>
              <Trash2 />
            </IconButton>
          </>
        ) : (
          <Button variant="ghost" size="sm" icon={<Undo2 />} onClick={() => onStatus("active")}>
            恢复待复习
          </Button>
        )}
      </div>
    </article>
  );
}
