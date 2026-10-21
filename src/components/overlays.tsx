import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { useUi } from "../store/AppStore";
import { Button, IconButton } from "./ui";
import { cn } from "../lib/text";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "dialog" | "sheet";
  dismissible?: boolean;
}

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 多层弹窗（例如导出预览上再确认）共用一个滚动锁与 inert 状态。 */
let openModalCount = 0;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  variant = "dialog",
  dismissible = true
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    openModalCount += 1;
    document.body.classList.add("has-modal");
    const appRoot = document.getElementById("root");
    if (appRoot) appRoot.inert = true;
    const timer = window.setTimeout(() => {
      const preferred = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus], [autofocus]");
      const first = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (preferred ?? first ?? dialogRef.current)?.focus();
    }, 30);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (node) => node.offsetParent !== null
      );
      if (!nodes.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKey);
      openModalCount = Math.max(0, openModalCount - 1);
      if (!openModalCount) {
        document.body.classList.remove("has-modal");
        if (appRoot) appRoot.inert = false;
      }
      previous?.focus?.();
    };
  }, [open, dismissible]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn("overlay", variant === "sheet" && "overlay-sheet")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      <div
        className={cn("modal", `modal-${size}`, variant === "sheet" && "modal-sheet")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={dialogRef}
        tabIndex={-1}
      >
        <span className="modal-grip" aria-hidden="true" />
        <header className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {dismissible ? (
            <IconButton label="关闭" variant="plain" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          ) : null}
        </header>
        {children ? <div className="modal-body">{children}</div> : null}
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmHost() {
  const { confirmState, resolveConfirm } = useUi();
  const danger = confirmState?.tone === "danger";
  return (
    <Modal
      open={Boolean(confirmState)}
      onClose={() => resolveConfirm(false)}
      title={confirmState?.title ?? ""}
      description={confirmState?.description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => resolveConfirm(false)}>
            {confirmState?.cancelText ?? "取消"}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={() => resolveConfirm(true)}
            data-autofocus
          >
            {confirmState?.confirmText ?? "确认"}
          </Button>
        </>
      }
    >
      {danger ? (
        <div className="confirm-warning">
          <AlertTriangle aria-hidden="true" />
          <span>
            {confirmState?.recoverable
              ? "该操作会修改本地数据，但可以从回收站恢复。"
              : "该操作会修改本地数据，且无法撤销。建议先在“我的 → 数据”中导出备份。"}
          </span>
        </div>
      ) : null}
    </Modal>
  );
}

export function ToastViewport() {
  const { toasts, dismissToast } = useUi();
  if (!toasts.length) return null;
  return createPortal(
    <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={cn("toast", `toast-${toast.tone}`)}>
          <span className="toast-mark" aria-hidden="true" />
          <p>{toast.message}</p>
          <button type="button" className="toast-close" aria-label="关闭提示" onClick={() => dismissToast(toast.id)}>
            <X />
          </button>
          <span className="toast-progress" style={{ animationDuration: `${toast.duration}ms` }} aria-hidden="true" />
        </div>
      ))}
    </div>,
    document.body
  );
}
