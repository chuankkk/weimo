import type { PracticeSessionState } from "../../types";
import { ProgressBar } from "../../components/ui";
import { cn } from "../../lib/text";

/**
 * 练习进度轨：题目较少时用可点击的方格展示每一题，
 * 超过 48 题退回连续进度条，避免出现上百个触控目标。
 */
export function RunnerRail({
  session,
  current,
  onJump
}: {
  session: PracticeSessionState;
  current: number;
  onJump: (index: number) => void;
}) {
  const total = session.questionIds.length;
  if (total > 48) {
    const progress = total ? (current + (session.submitted[session.questionIds[current]] ? 1 : 0)) / total : 0;
    return <ProgressBar value={progress} label="练习进度" />;
  }

  return (
    <div className="runner-rail" role="group" aria-label="题目进度">
      {session.questionIds.map((id, index) => {
        const answered = Boolean(session.submitted[id]);
        return (
          <button
            key={id}
            type="button"
            className={cn("rail-cell", answered && "is-answered", index === current && "is-current")}
            onClick={() => onJump(index)}
            aria-current={index === current ? "step" : undefined}
            aria-label={`第 ${index + 1} 题${answered ? "，已作答" : "，未作答"}`}
            title={`第 ${index + 1} 题${answered ? " · 已答" : ""}`}
          />
        );
      })}
    </div>
  );
}
