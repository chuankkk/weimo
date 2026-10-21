import { useRef, useState, type DragEvent } from "react";
import {
  BookMarked,
  Download,
  FileSpreadsheet,
  FileText,
  Upload
} from "lucide-react";
import type { ImportReport } from "../types";
import {
  exportImportTemplate,
  exportJsonBackup,
  exportQuestionCsv,
  exportQuestionExcel,
  importDataFile
} from "../data/io";
import { useApp } from "../store/AppStore";
import { Button, InlineNotice, Spinner } from "./ui";
import { cn } from "../lib/text";

export type DataBusy = "" | "import" | "export";

export const useDataTools = () => {
  const { state, update, replace, toast, confirm } = useApp();
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<DataBusy>("");

  const importFile = async (file: File) => {
    if (busy) return;
    setBusy("import");
    try {
      const outcome = await importDataFile(state, file);
      if (outcome.restored) {
        const accepted = await confirm({
          title: "恢复完整备份？",
          description: `检测到完整备份：${outcome.state.banks.length} 个题库、${outcome.state.questions.length} 道题。恢复后将覆盖当前所有题库与学习记录。`,
          confirmText: "覆盖并恢复",
          tone: "danger"
        });
        if (!accepted) return;
        replace(outcome.state);
        setReport(outcome.report);
        toast("完整备份已恢复", { tone: "success" });
        return;
      }
      setReport(outcome.report);
      if (outcome.report.imported > 0) {
        update(() => outcome.state);
        toast(`已导入 ${outcome.report.imported} 道题`, { tone: "success" });
      } else if (outcome.report.errors.length) {
        toast(outcome.report.errors[0], { tone: "error" });
      } else {
        toast("文件中没有可导入的新题目", { tone: "error" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setReport({ imported: 0, skipped: 0, errors: [`导入失败：${message}`], warnings: [] });
      toast(`导入失败：${message}`, { tone: "error" });
    } finally {
      setBusy("");
    }
  };

  const runExport = async (kind: "excel" | "csv" | "backup" | "template") => {
    if (busy) return;
    setBusy("export");
    try {
      if (kind === "excel") await exportQuestionExcel(state);
      if (kind === "csv") await exportQuestionCsv(state);
      if (kind === "backup") await exportJsonBackup(state);
      if (kind === "template") await exportImportTemplate();
      toast(kind === "template" ? "导入模板已生成" : "导出文件已生成", { tone: "success" });
    } catch (error) {
      toast(`导出失败：${error instanceof Error ? error.message : "未知错误"}`, { tone: "error" });
    } finally {
      setBusy("");
    }
  };

  return { report, setReport, busy, importFile, runExport };
};

export function ImportReportView({ report }: { report: ImportReport | null }) {
  if (!report) return null;
  const messages = [...report.errors, ...report.warnings];
  const shown = messages.slice(0, 8);
  return (
    <section className="import-report" aria-live="polite">
      <header>
        <strong>导入结果</strong>
        <span>
          新增 <b>{report.imported}</b> 题 · 跳过 <b>{report.skipped}</b> 题
        </span>
      </header>
      {!messages.length ? (
        <p className="import-clean">所有题目均已通过校验。</p>
      ) : (
        <ul>
          {shown.map((message, index) => (
            <li key={`${message}-${index}`} className={report.errors.includes(message) ? "is-error" : "is-warn"}>
              {message}
            </li>
          ))}
        </ul>
      )}
      {messages.length > shown.length ? (
        <p className="import-more">另有 {messages.length - shown.length} 条提示未显示</p>
      ) : null}
    </section>
  );
}

export function DataTools({ compact = false }: { compact?: boolean }) {
  const { state } = useApp();
  const { report, busy, importFile, runExport } = useDataTools();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (file?: File) => {
    if (!file) return;
    void importFile(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="data-tools">
      <div
        className={cn("drop-zone", dragging && "is-dragging", busy === "import" && "is-busy")}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json"
          onChange={(event) => {
            pick(event.target.files?.[0]);
            event.target.value = "";
          }}
          aria-label="选择题库文件"
        />
        <span className="drop-icon">
          {busy === "import" ? <Spinner size={22} /> : <Upload aria-hidden="true" />}
        </span>
        <div className="drop-copy">
          <strong>{busy === "import" ? "正在解析文件…" : "导入题库文件"}</strong>
          <p>支持 Excel / CSV / JSON。拖入文件或点击选择；完整备份会提示覆盖。</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={Boolean(busy)}
        >
          选择文件
        </Button>
      </div>

      <div className={cn("tool-grid", compact && "is-compact")}>
        <button type="button" className="tool-card" onClick={() => void runExport("excel")} disabled={Boolean(busy) || !state.questions.length}>
          <FileSpreadsheet aria-hidden="true" />
          <span>
            <strong>导出 Excel</strong>
            <small>保留题库层级与题型</small>
          </span>
        </button>
        <button type="button" className="tool-card" onClick={() => void runExport("csv")} disabled={Boolean(busy) || !state.questions.length}>
          <FileText aria-hidden="true" />
          <span>
            <strong>导出 CSV</strong>
            <small>适合批量编辑</small>
          </span>
        </button>
        <button type="button" className="tool-card" onClick={() => void runExport("backup")} disabled={Boolean(busy)}>
          <BookMarked aria-hidden="true" />
          <span>
            <strong>完整备份</strong>
            <small>题库与学习记录</small>
          </span>
        </button>
        <button type="button" className="tool-card" onClick={() => void runExport("template")} disabled={Boolean(busy)}>
          <Download aria-hidden="true" />
          <span>
            <strong>导入模板</strong>
            <small>下载示例 CSV</small>
          </span>
        </button>
      </div>

      <ImportReportView report={report} />
      {!report ? (
        <InlineNotice>
          导入按“大题库 / 小题库 / 题型 / 题干 / 答案”识别列，重复题会自动跳过。详见导入模板。
        </InlineNotice>
      ) : null}
    </div>
  );
}
