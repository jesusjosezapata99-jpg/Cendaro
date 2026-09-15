import type {
  ColumnDef,
  OnChangeFn,
  Row,
  RowData,
  RowSelectionState,
  Table,
} from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    sticky?: boolean | "left" | "right";
    className?: string;
    headerClassName?: string;
    numeric?: boolean;
    skeleton?: "text" | "badge" | "avatar-text" | "icon" | "number";
  }
}

export type SortDirection = "asc" | "desc";

export interface ParsedSort {
  column: string;
  direction: SortDirection;
}

/** Parse sort string format "column:asc" or "column:desc" */
export function parseSortParam(sort?: string | null): ParsedSort | null {
  if (!sort) return null;
  const [column, direction] = sort.split(":");
  if (!column || (direction !== "asc" && direction !== "desc")) return null;
  return { column, direction };
}

/** Serialize sort state to string format "column:asc" or "column:desc" */
export function formatSortParam(
  column: string,
  direction: SortDirection,
): string {
  return `${column}:${direction}`;
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  totalCount?: number;
  sort?: string;
  onSortChange?: (sort: string | undefined) => void;
  onRowClick?: (row: TData) => void;
  getRowHref?: (row: TData) => string;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  getRowId?: (row: TData, index: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  onResetFilters?: () => void;
  renderCustomEmpty?: () => React.ReactNode;
  isError?: boolean;
  onRetry?: () => void;
  errorTitle?: string;
  errorDescription?: string;
  renderBottomBar?: (
    selectedRows: TData[],
    clearSelection: () => void,
  ) => React.ReactNode;
  className?: string;
  containerClassName?: string;
  virtualizeThreshold?: number;
}

export interface DataTableHeaderProps<TData> {
  table: Table<TData>;
  currentSort?: ParsedSort | null;
  onSortToggle?: (columnId: string) => void;
}

export interface VirtualRowProps<TData> {
  row: Row<TData>;
  style?: React.CSSProperties;
  onRowClick?: (data: TData) => void;
  getRowHref?: (data: TData) => string;
  isSelected?: boolean;
}
