import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./DataTable.module.css";

export type DataTableColumn = {
  header: ReactNode;
  /** CSS flex-basis-ish width, e.g. "120px" or "auto" for the growing column. */
  width?: string;
  right?: boolean;
  mono?: boolean;
};

export type DataTableProps = {
  columns: DataTableColumn[];
  rows: ReactNode[][];
  /** Row click makes the row a link to that order's S2 card (S1.6, S2.10, S2.11). */
  onRowClick?: (rowIndex: number) => void;
};

/**
 * A desktop table: header row plus data rows. A clickable row gets a
 * chevron-right and, on click, navigates to that order.
 */
export function DataTable({ columns, rows, onRowClick }: DataTableProps) {
  return (
    <div className={styles.table} role="table">
      <div className={[styles.row, styles.head].join(" ")} role="row">
        {columns.map((col, i) => (
          <span
            className={[styles.cell, col.right && styles.cellRight].filter(Boolean).join(" ")}
            style={{ flexBasis: col.width, flexGrow: col.width === "auto" || !col.width ? 1 : 0 }}
            role="columnheader"
            key={i}
          >
            {col.header}
          </span>
        ))}
        {onRowClick && <span className={styles.chevron} aria-hidden />}
      </div>
      {rows.map((row, rowIndex) => {
        const clickable = Boolean(onRowClick);
        return (
          <div
            className={[styles.row, clickable && styles.clickable].filter(Boolean).join(" ")}
            role="row"
            key={rowIndex}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onRowClick?.(rowIndex) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick?.(rowIndex);
                    }
                  }
                : undefined
            }
          >
            {row.map((cell, cellIndex) => {
              const col = columns[cellIndex];
              return (
                <span
                  className={[styles.cell, col?.right && styles.cellRight, col?.mono && styles.cellMono]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ flexBasis: col?.width, flexGrow: col?.width === "auto" || !col?.width ? 1 : 0 }}
                  role="cell"
                  key={cellIndex}
                >
                  {cell}
                </span>
              );
            })}
            {clickable && (
              <span className={styles.chevron}>
                <Icon name="chevron-right" size={16} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
