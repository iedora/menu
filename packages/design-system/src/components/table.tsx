import type {
  HTMLAttributes,
  TableHTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "../lib/cn";

type TableProps = TableHTMLAttributes<HTMLTableElement> & { children: ReactNode };

/**
 * Iedora Manual § VI.5. Mono uppercase head, serif rows, hairline divisions.
 * Numbers should use tabular-nums (set automatically by the stylesheet).
 *
 * Use plain <thead> / <tbody> / <tr> children; only the cell helpers below
 * get the editorial styling.
 */
export function Table({ className, children, ...rest }: TableProps) {
  return (
    <table {...rest} className={cn("ds-table", className)}>
      {children}
    </table>
  );
}

type TheadCellProps = ThHTMLAttributes<HTMLTableCellElement> & {
  children?: ReactNode;
};
export function Th({ className, children, ...rest }: TheadCellProps) {
  return (
    <th {...rest} scope={rest.scope ?? "col"} className={cn("ds-table__th", className)}>
      {children}
    </th>
  );
}

type TdProps = TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode };
export function Td({ className, children, ...rest }: TdProps) {
  return (
    <td {...rest} className={cn("ds-table__td", className)}>
      {children}
    </td>
  );
}

type RowNumProps = HTMLAttributes<HTMLSpanElement> & { children: ReactNode };
export function TableRowNum({ className, children, ...rest }: RowNumProps) {
  return (
    <span {...rest} className={cn("ds-table__n", className)}>
      {children}
    </span>
  );
}
