import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { useApp } from "../store/AppStore";
import { downloadBlob } from "../data/io";
import { buildWrongBookHtml, defaultWrongBookOptions, wrongBookFileName, type WrongBookOptions } from "../lib/notebook";
import { Button } from "./ui";
import { Modal } from "./overlays";

export function WrongBookExport({
  open,
  onClose,
  bankId
}: {
  open: boolean;
  onClose: () => void;
  bankId?: string;
}) {
  const { state, catalog, toast } = useApp();
  const [options, setOptions] = useState<WrongBookOptions>(defaultWrongBookOptions);
  const bank = bankId ? catalog.bankById.get(bankId) : undefined;
  const bankLabel = bank ? catalog.bankPath(bank.id).map((item) => item.name).join(" / ") : "全部题库";

  const html = useMemo(
    () => buildWrongBookHtml(state, catalog, bankId, options),
    [state, catalog, bankId, options]
  );

  const updateOption = (key: keyof WrongBookOptions) => {
    setOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const download = async () => {
    try {
      await downloadBlob(wrongBookFileName(bank?.name), new Blob([html], { type: "text/html;charset=utf-8" }));
      toast("错题本已生成，可打开浏览器打印或分享", { tone: "success" });
    } catch {
      toast("导出失败，请重试", { tone: "error" });
    }
  };

  const print = () => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
    frame.srcdoc = html;
    frame.onload = () => {
      const view = frame.contentWindow;
      if (!view) return;
      view.focus();
      view.print();
      window.setTimeout(() => frame.remove(), 1500);
    };
    document.body.appendChild(frame);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="导出错题本"
      description={`${bankLabel} · 生成带解析、答案和笔记的 A4 排版文档`}
      footer={
        <div className="notebook-actions">
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
          <Button variant="secondary" icon={<Printer />} onClick={print}>
            打印 / 存为 PDF
          </Button>
          <Button icon={<Download />} onClick={() => void download()}>
            下载 HTML
          </Button>
        </div>
      }
    >
      <div className="notebook-options">
        <label>
          <input
            type="checkbox"
            checked={options.includeMastered}
            onChange={() => updateOption("includeMastered")}
          />
          包含已掌握
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.includeIgnored}
            onChange={() => updateOption("includeIgnored")}
          />
          包含已忽略
        </label>
        <label>
          <input type="checkbox" checked={options.includeNotes} onChange={() => updateOption("includeNotes")} />
          附带笔记
        </label>
        <span className="notebook-hint">打印时选择 A4，页边距默认即可。</span>
      </div>
      <iframe className="notebook-preview" title="错题本预览" srcDoc={html} />
    </Modal>
  );
}
