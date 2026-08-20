import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  ExternalLink,
  File,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  Home,
  Info,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Trash2,
  Upload,
  User,
  X,
  XCircle,
} from "lucide-react";

export type IconCategory =
  | "common"
  | "navigation"
  | "actions"
  | "status"
  | "file"
  | "inKit";

export type IconEntry = {
  name: string;
  label: string;
  Icon: LucideIcon;
  category: IconCategory;
  importName?: string;
};

/** Curated Lucide icons for minikb admin UI (Direction 02). */
export const iconCatalog: IconEntry[] = [
  { name: "Search", label: "搜索", Icon: Search, category: "common" },
  { name: "Plus", label: "添加", Icon: Plus, category: "common" },
  { name: "X", label: "关闭", Icon: X, category: "common" },
  { name: "Check", label: "勾选", Icon: Check, category: "common" },
  { name: "ChevronDown", label: "展开", Icon: ChevronDown, category: "common" },
  { name: "ChevronRight", label: "前进", Icon: ChevronRight, category: "common" },
  { name: "ChevronLeft", label: "返回", Icon: ChevronLeft, category: "common" },
  { name: "MoreHorizontal", label: "更多", Icon: MoreHorizontal, category: "common" },
  { name: "Settings", label: "设置", Icon: Settings, category: "common" },
  { name: "User", label: "用户", Icon: User, category: "common" },
  { name: "LogOut", label: "退出", Icon: LogOut, category: "common" },
  { name: "Loader2", label: "加载中", Icon: Loader2, category: "common" },
  { name: "Calendar", label: "日历", Icon: Calendar, category: "common" },

  { name: "Home", label: "首页", Icon: Home, category: "navigation" },
  { name: "Menu", label: "菜单", Icon: Menu, category: "navigation" },
  { name: "ArrowLeft", label: "左箭头", Icon: ArrowLeft, category: "navigation" },
  { name: "ArrowRight", label: "右箭头", Icon: ArrowRight, category: "navigation" },
  { name: "ArrowUpRight", label: "外链", Icon: ArrowUpRight, category: "navigation" },
  { name: "ExternalLink", label: "外部链接", Icon: ExternalLink, category: "navigation" },

  { name: "Pencil", label: "编辑", Icon: Pencil, category: "actions" },
  { name: "Trash2", label: "删除", Icon: Trash2, category: "actions" },
  { name: "Copy", label: "复制", Icon: Copy, category: "actions" },
  { name: "Download", label: "下载", Icon: Download, category: "actions" },
  { name: "Upload", label: "上传", Icon: Upload, category: "actions" },
  { name: "RefreshCw", label: "刷新", Icon: RefreshCw, category: "actions" },
  { name: "Save", label: "保存", Icon: Save, category: "actions" },
  { name: "Filter", label: "筛选", Icon: Filter, category: "actions" },

  { name: "Info", label: "信息", Icon: Info, category: "status" },
  { name: "AlertCircle", label: "警告", Icon: AlertCircle, category: "status" },
  { name: "AlertTriangle", label: "注意", Icon: AlertTriangle, category: "status" },
  { name: "CheckCircle2", label: "成功", Icon: CheckCircle2, category: "status" },
  { name: "XCircle", label: "错误", Icon: XCircle, category: "status" },

  { name: "File", label: "文件", Icon: File, category: "file" },
  { name: "FileText", label: "文档", Icon: FileText, category: "file" },
  { name: "Folder", label: "文件夹", Icon: Folder, category: "file" },
  { name: "FolderOpen", label: "打开文件夹", Icon: FolderOpen, category: "file" },
  { name: "BookOpen", label: "知识库", Icon: BookOpen, category: "file" },
  { name: "Database", label: "数据库", Icon: Database, category: "file" },

  {
    name: "SearchIcon",
    label: "搜索（Command）",
    Icon: Search,
    category: "inKit",
    importName: "SearchIcon",
  },
  {
    name: "CheckIcon",
    label: "勾选（Checkbox）",
    Icon: Check,
    category: "inKit",
    importName: "CheckIcon",
  },
  {
    name: "Loader2Icon",
    label: "加载（Spinner）",
    Icon: Loader2,
    category: "inKit",
    importName: "Loader2Icon",
  },
  {
    name: "XIcon",
    label: "关闭（Dialog）",
    Icon: X,
    category: "inKit",
    importName: "XIcon",
  },
];

export const iconCategoryLabels: Record<IconCategory, string> = {
  common: "常用",
  navigation: "导航",
  actions: "操作",
  status: "状态",
  file: "文件",
  inKit: "组件内置",
};

export function iconsByCategory(category: IconCategory | "all") {
  if (category === "all") return iconCatalog;
  return iconCatalog.filter((entry) => entry.category === category);
}

export function iconImportStatement(entry: IconEntry) {
  const symbol = entry.importName ?? entry.name;
  return `import { ${symbol} } from "lucide-react";`;
}
