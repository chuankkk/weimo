import { useState } from "react";
import { Plus } from "lucide-react";
import type { Question, QuestionBank } from "../types";
import { useApp } from "../store/AppStore";
import { navigate, useRoute } from "../lib/router";
import { useDocumentTitle } from "../lib/hooks";
import { QuestionEditor } from "../components/QuestionEditor";
import { Button, PageHeader, Segmented } from "../components/ui";
import { BankCatalog } from "./banks/BankCatalog";
import { BankDetail } from "./banks/BankDetail";
import { BankFormModal } from "./banks/BankFormModal";
import { BankImportView } from "./banks/BankImportView";
import { BankMergeView } from "./banks/BankMergeView";
import { BankTrashView } from "./banks/BankTrashView";
import { bankViewOptions, type BanksView } from "./banks/shared";

export function BanksPage() {
  useDocumentTitle("题库");
  const { state, catalog } = useApp();
  const route = useRoute();
  const rawView = route.params.get("view");
  const view: BanksView = rawView === "import" || rawView === "merge" || rawView === "trash" ? rawView : "catalog";
  const activeBankId = route.params.get("bank");
  const activeBankLookup = activeBankId ? catalog.bankById.get(activeBankId) : undefined;
  const activeBank =
    activeBankLookup && !activeBankLookup.archived && !activeBankLookup.deletedAt ? activeBankLookup : undefined;
  const [createBankOpen, setCreateBankOpen] = useState(false);
  const [createChildParent, setCreateChildParent] = useState<string | undefined>();
  const [editBank, setEditBank] = useState<QuestionBank | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; bankId: string; question: Question | null }>({
    open: false,
    bankId: "",
    question: null
  });

  if (activeBank) {
    return (
      <>
        <BankDetail
          key={activeBank.id}
          bank={activeBank}
          onEditBank={() => setEditBank(activeBank)}
          onAddChild={() => {
            setCreateChildParent(activeBank.id);
            setCreateBankOpen(true);
          }}
          onAddQuestion={(bankId) => setEditor({ open: true, bankId, question: null })}
          onEditQuestion={(question) => setEditor({ open: true, bankId: question.bankId, question })}
        />
        <BankFormModal
          open={createBankOpen}
          onClose={() => setCreateBankOpen(false)}
          parentId={createChildParent}
        />
        <BankFormModal open={Boolean(editBank)} onClose={() => setEditBank(null)} bank={editBank ?? undefined} />
        <QuestionEditor
          open={editor.open}
          onClose={() => setEditor((current) => ({ ...current, open: false }))}
          bankId={editor.bankId}
          question={editor.question}
        />
      </>
    );
  }

  return (
    <section className="page banks-page">
      <PageHeader
        eyebrow="题库"
        title="你的知识册页"
        subtitle={`共 ${catalog.roots.length} 个一级题库、${catalog.visibleBanks.length} 个题库、${catalog.questions.length} 道题。`}
        actions={
          <Button
            icon={<Plus />}
            onClick={() => {
              setCreateChildParent(undefined);
              setCreateBankOpen(true);
            }}
          >
            新建题库
          </Button>
        }
      />

      <div className="bank-subnav">
        <Segmented
          ariaLabel="题库视图"
          value={view}
          onChange={(next) => navigate("banks", next === "catalog" ? undefined : { view: next })}
          options={bankViewOptions.map((option) =>
            option.value === "trash" && state.trash.length ? { ...option, badge: state.trash.length } : option
          )}
        />
      </div>

      {view === "catalog" ? (
        <BankCatalog
          onOpenBank={(id) => navigate("banks", { bank: id })}
          onCreateBank={() => {
            setCreateChildParent(undefined);
            setCreateBankOpen(true);
          }}
        />
      ) : null}
      {view === "import" ? <BankImportView /> : null}
      {view === "merge" ? <BankMergeView /> : null}
      {view === "trash" ? <BankTrashView /> : null}

      <BankFormModal
        open={createBankOpen}
        onClose={() => setCreateBankOpen(false)}
        parentId={createChildParent}
      />
    </section>
  );
}
