import { useEffect } from "react";
import { navigate, useRoute } from "../lib/router";
import { useDocumentTitle } from "../lib/hooks";
import { useApp } from "../store/AppStore";
import { ExamPlanner } from "./exam/ExamPlanner";
import { ExamRunner } from "./exam/ExamRunner";
import { ExamReport } from "./exam/ExamReport";

export function ExamPage() {
  const route = useRoute();
  const { state } = useApp();
  const sessionId = route.params.get("session");
  const session = sessionId ? state.examSessions.find((item) => item.id === sessionId) : undefined;
  useDocumentTitle(session?.status === "running" ? "考试中" : session ? "考试报告" : "模拟考试");

  useEffect(() => {
    if (sessionId && !session) navigate("exam");
  }, [sessionId, session]);

  if (session?.status === "running") return <ExamRunner session={session} />;
  if (session) return <ExamReport session={session} />;
  return <ExamPlanner />;
}
