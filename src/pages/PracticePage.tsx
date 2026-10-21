import { useRoute } from "../lib/router";
import { useDocumentTitle } from "../lib/hooks";
import { useApp } from "../store/AppStore";
import { PracticeSetup } from "./practice/PracticeSetup";
import { PracticeRunner } from "./practice/PracticeRunner";
import { PracticeSummary } from "./practice/PracticeSummary";

export function PracticePage() {
  const route = useRoute();
  const { state } = useApp();
  const session = state.practiceSession;
  const run = route.params.get("run") === "1";
  const showRunner = Boolean(run && session && !session.completedAt);
  const showSummary = Boolean(run && session?.completedAt);
  useDocumentTitle(showRunner ? "练习中" : showSummary ? "练习完成" : "练习");

  if (showRunner && session) return <PracticeRunner session={session} />;
  if (showSummary && session) return <PracticeSummary session={session} />;
  return <PracticeSetup />;
}
