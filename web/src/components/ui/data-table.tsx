"use client";

import * as React from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Skeleton } from "./skeleton";
import { Spinner } from "./spinner";

/* ── Types ──────────────────────────────────── */

export interface Column<T> {
  /** Column header text */
  header: string;
  /** Accessor key or function to get the cell value */
  accessor: keyof T | ((row: T) => React.ReactNode);
  /** Optional sort key (defaults to accessor if string) */
  sortKey?: string;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Custom cell renderer */
  cell?: (value: unknown, row: T, index: number) => React.ReactNode;
  /** Column class name */
  className?: string;
  /** Header class name */
  headerClassName?: string;
  /** Hide on mobile */
  hideOnMobile?: boolean;
  /** Text alignment */
  align?: "left" | "center" | "right";
}

interface DataTableProps<T> {
  /** Unique key for the table (used for selection) */
  id?: string;
  /** Column definitions */
  columns: Column<T>[];
  /** Data rows */
  data: T[];
  /** Unique row identifier */
  rowKey: keyof T | ((row: T) => string | number);
  /** Loading state — shows skeleton */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state icon */
  emptyIcon?: React.ElementType;
  /** Enable pagination */
  paginate?: boolean;
  /** Page size */
  pageSize?: number;
  /** Current page (controlled) */
  page?: number;
  /** On page change */
  onPageChange?: (page: number) => void;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Row class name */
  rowClassName?: string | ((row: T, index: number) => string);
  /** Enable sorting */
  sortable?: boolean;
  /** External sort state */
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string, direction: "asc" | "desc") => void;
  /** Top-right actions slot */
  actions?: React.ReactNode;
  /** Search/Filter bar placeholder */
  searchPlaceholder?: string;
  /** Search value */
  searchValue?: string;
  /** On search change */
  onSearchChange?: (value: string) => void;
  /** Total number of items (for server-side pagination) */
  totalItems?: number;
  /** Additional wrapper class name */
  className?: string;
  /** Compact mode */
  compact?: boolean;
  /** Sticky header */
  stickyHeader?: boolean;
}

/* ── Helpers ────────────────────────────────── */

function getValue<T>(row: T, accessor: keyof T | ((row: T) => React.ReactNode)): unknown {
  if (typeof accessor === "function") return accessor(row);
  return row[accessor];
}

function getRowKey<T>(row: T, key: keyof T | ((row: T) => string | number)): string | number {
  if (typeof key === "function") return key(row);
  return String(row[key]);
}

/* ── Sortable Header ────────────────────────── */

interface SortHeaderProps {
  column: string;
  label: string;
  direction?: "asc" | "desc";
  active?: boolean;
  onClick: () => void;
  className?: string;
}

function SortHeader({ column, label, direction, active, onClick, className }: SortHeaderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      aria-label={`Ordenar por ${label}${active && direction === "asc" ? " (ascendente)" : active && direction === "desc" ? " (descendente)" : ""}`}
      aria-sort={
        active
          ? direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <span>{label}</span>
      {active ? (
        direction === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" aria-hidden="true" />
      )}
    </button>
  );
}

/* ── Loading Rows ───────────────────────────── */

function LoadingRows({ columns, count = 5, compact }: { columns: number; count?: number; compact?: boolean }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={`skeleton-${i}`} className="border-b border-border/50 last:border-0">
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className={compact ? "p-2.5" : "p-3"}>
              <Skeleton
                variant="text"
                className={cn(
                  "h-4",
                  j === 0 ? "w-3/4" : j === columns - 1 ? "w-1/4" : "w-1/2"
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ── Pagination ─────────────────────────────── */

function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium">{startItem}</span>
        {" — "}
        <span className="font-medium">{endItem}</span>
        {" de "}
        <span className="font-medium">{totalItems}</span>
        {" registros"}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
            // Show window around current page
            let pageNum: number;
            if (totalPages <= 7) {
              pageNum = i;
            } else if (currentPage < 3) {
              pageNum = i;
            } else if (currentPage > totalPages - 4) {
              pageNum = totalPages - 7 + i;
            } else {
              pageNum = currentPage - 3 + i;
            }

            return (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? "secondary" : "ghost"}
                size="sm"
                className="h-7 min-w-7 p-0 text-xs"
                onClick={() => onPageChange(pageNum)}
                aria-label={`Página ${pageNum + 1}`}
                aria-current={pageNum === currentPage ? "page" : undefined}
              >
                {pageNum + 1}
              </Button>
            );
          })}
        </div>

        {totalPages > 1 && (
          <>
            {/* Mobile: show current page */}
            <span className="text-xs sm:hidden px-2 text-muted-foreground">
              {currentPage + 1} / {totalPages}
            </span>
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Main DataTable ─────────────────────────── */

function DataTable<T extends Record<string, any>>({
  id,
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = "No se encontraron registros",
  emptyIcon: EmptyIcon = Search,
  paginate = false,
  pageSize = 10,
  page: externalPage,
  onPageChange: externalOnPageChange,
  onRowClick,
  rowClassName,
  sortable = true,
  sortColumn: externalSortColumn,
  sortDirection: externalSortDirection,
  onSort: externalOnSort,
  actions,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  totalItems: externalTotalItems,
  className,
  compact = false,
  stickyHeader = false,
}: DataTableProps<T>) {
  const [internalPage, setInternalPage] = React.useState(0);
  const [internalSortColumn, setInternalSortColumn] = React.useState<string | undefined>();
  const [internalSortDirection, setInternalSortDirection] = React.useState<"asc" | "desc">("asc");

  // Determine if controlled or internal state
  const isControlled = externalPage !== undefined;
  const currentPage = isControlled ? externalPage! : internalPage;
  const currentSortColumn = externalSortColumn ?? internalSortColumn;
  const currentSortDirection = externalSortDirection ?? internalSortDirection;

  const handlePageChange = (page: number) => {
    if (externalOnPageChange) {
      externalOnPageChange(page);
    } else {
      setInternalPage(page);
    }
  };

  const handleSort = (column: string) => {
    let direction: "asc" | "desc" = "asc";
    if (currentSortColumn === column) {
      direction = currentSortDirection === "asc" ? "desc" : "asc";
    }
    if (externalOnSort) {
      externalOnSort(column, direction);
    } else {
      setInternalSortColumn(column);
      setInternalSortDirection(direction);
    }
  };

  // Client-side sorting
  const sortedData = React.useMemo(() => {
    if (!sortable || !currentSortColumn) return data;
    // Find the column definition for this sort key
    const colDef = columns.find(
      (col) => (col.sortKey ?? (typeof col.accessor === "string" ? col.accessor : undefined)) === currentSortColumn
    );
    if (!colDef || typeof colDef.accessor !== "string") return data;

    return [...data].sort((a, b) => {
      const aVal = a[colDef.accessor as keyof T];
      const bVal = b[colDef.accessor as keyof T];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), "es", { numeric: true });
      return currentSortDirection === "asc" ? cmp : -cmp;
    });
  }, [data, sortable, currentSortColumn, currentSortDirection, columns]);

  // Client-side pagination
  const totalItems = externalTotalItems ?? sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedData = paginate
    ? sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : sortedData;

  // Reset page when data changes
  React.useEffect(() => {
    if (!isControlled && currentPage >= totalPages) {
      setInternalPage(0);
    }
  }, [data, totalPages, isControlled, currentPage]);

  const tableId = id ?? "data-table";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card",
        className
      )}
    >
      {/* ── Toolbar ──────────────────────────── */}
      {(searchPlaceholder || actions) && (
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          {searchPlaceholder && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-foreground/30 transition-colors"
                aria-label="Buscar"
              />
            </div>
          )}
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* ── Table ────────────────────────────── */}
      <div className="overflow-x-auto">
        <table
          className="w-full caption-bottom text-sm"
          role="grid"
          aria-label="Tabla de datos"
          aria-busy={loading}
        >
          {/* ── Header ───────────────────────── */}
          <thead>
            <tr className="border-b border-border">
              {columns.map((col, i) => {
                const sortKey = col.sortKey ?? (typeof col.accessor === "string" ? col.accessor : undefined);
                const isActive = currentSortColumn === sortKey;

                return (
                  <th
                    key={i}
                    className={cn(
                      "px-3 py-3 text-left",
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right",
                      col.hideOnMobile && "hidden sm:table-cell",
                      col.headerClassName
                    )}
                    scope="col"
                  >
                    {sortable && sortKey ? (
                      <SortHeader
                        column={sortKey}
                        label={col.header}
                        direction={currentSortDirection}
                        active={isActive}
                        onClick={() => handleSort(sortKey)}
                        className={col.className}
                      />
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {col.header}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ── Body ─────────────────────────── */}
          <tbody>
            {loading ? (
              <LoadingRows columns={columns.length} count={5} compact={compact} />
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    {EmptyIcon && (
                      <EmptyIcon className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
                    )}
                    <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIndex) => {
                const key = getRowKey(row, rowKey);
                const isClickable = !!onRowClick;
                const rowCn = typeof rowClassName === "function" ? rowClassName(row, rowIndex) : rowClassName;

                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-b border-border/50 last:border-0 transition-colors",
                      isClickable && "cursor-pointer hover:bg-accent/50",
                      rowCn
                    )}
                    onClick={() => onRowClick?.(row)}
                    onKeyDown={(e) => {
                      if (isClickable && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onRowClick?.(row);
                      }
                    }}
                    tabIndex={isClickable ? 0 : undefined}
                    role={isClickable ? "button" : undefined}
                    aria-label={isClickable ? `Ver detalle de fila ${rowIndex + 1}` : undefined}
                  >
                    {columns.map((col, colIndex) => {
                      const rawValue = getValue(row, col.accessor);
                      const cellContent = col.cell
                        ? col.cell(rawValue, row, rowIndex)
                        : (rawValue as React.ReactNode);

                      return (
                        <td
                          key={colIndex}
                          className={cn(
                            compact ? "p-2.5" : "p-3",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right",
                            col.hideOnMobile && "hidden sm:table-cell",
                            col.className
                          )}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ───────────────────────── */}
      {paginate && !loading && totalPages > 1 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}

DataTable.displayName = "DataTable";

export { DataTable };
