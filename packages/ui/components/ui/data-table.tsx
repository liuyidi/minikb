"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@minikb/ui/lib/utils";

function DataTable<TData, TValue>({
  columns,
  data,
  className,
  estimateRowHeight = 44,
  maxHeight = 420,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  className?: string;
  estimateRowHeight?: number;
  maxHeight?: number;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto rounded-[var(--radius-lg)] border border-border", className)}
      style={{ maxHeight }}
    >
      <table className="w-full caption-bottom text-sm">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-border">
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="h-10 px-3 text-left font-medium text-muted-foreground">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <tr
                key={row.id}
                className="absolute left-0 w-full border-b border-border"
                style={{ transform: `translateY(${virtualRow.start}px)`, height: virtualRow.size }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { DataTable };
export type { ColumnDef, TanstackTable };
