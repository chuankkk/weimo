import { FolderOpen, Merge, Trash2, Upload } from "lucide-react";
import type { ReactNode } from "react";

export type BanksView = "catalog" | "import" | "merge" | "trash";

export const bankViewOptions: { value: BanksView; label: string; icon: ReactNode }[] = [
  { value: "catalog", label: "目录", icon: <FolderOpen /> },
  { value: "import", label: "导入导出", icon: <Upload /> },
  { value: "merge", label: "合并", icon: <Merge /> },
  { value: "trash", label: "回收站", icon: <Trash2 /> }
];
