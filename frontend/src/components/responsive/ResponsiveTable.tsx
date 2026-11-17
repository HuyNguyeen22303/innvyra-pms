import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useState,
  type Key,
  type ReactNode,
} from "react";
import {
  Button,
  Popconfirm,
  Space,
  Table,
  Tooltip,
  type TableProps,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useResponsiveLayout } from "./useResponsiveLayout.ts";
import { nodeText } from "./responsiveText.ts";

function actionItems(node: ReactNode): ReactNode[] {
  if (!isValidElement<{ children?: ReactNode; className?: string }>(node))
    return Children.toArray(node);
  if (node.type === Fragment || node.type === Space)
    return Children.toArray(node.props.children).flatMap((child) =>
      isValidElement(child) && child.type === Fragment
        ? actionItems(child)
        : [child],
    );
  return [node];
}
function CardActions({ children }: { children: ReactNode }) {
  const actions = actionItems(children);
  const labeled = (action: ReactNode, inheritedLabel = ""): ReactNode => {
    if (
      isValidElement<{ children?: ReactNode }>(action) &&
      action.type === Popconfirm
    )
      return cloneElement(action, {
        children: labeled(action.props.children, inheritedLabel),
      });
    if (
      isValidElement<{ title?: ReactNode; children?: ReactNode }>(action) &&
      action.type === Tooltip
    ) {
      return cloneElement(action, {
        children: labeled(
          action.props.children,
          nodeText(action.props.title) || inheritedLabel,
        ),
      });
    }
    if (
      isValidElement<{ children?: ReactNode; "aria-label"?: string }>(action) &&
      action.type === Button &&
      !nodeText(action.props.children)
    ) {
      const title = action.props["aria-label"] || inheritedLabel;
      if (title)
        return cloneElement(action, { children: title, "aria-label": title });
    }
    return action;
  };
  return (
    <div className="responsive-card-actions">
      {labeled(actions[0])}
      {actions.length > 1 && (
        <details className="responsive-more-actions">
          <summary>Thao tác khác</summary>
          <div>
            {actions.slice(1).map((action, index) => (
              <div key={index}>{labeled(action)}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** The actual Ant Table stays mounted: pagination, renderers, permissions and callbacks are unchanged. */
export function ResponsiveTable<T extends object>(
  props: TableProps<T> & { mobileLayout?: "cards" | "table" },
) {
  const { isMobile, isCompact } = useResponsiveLayout();
  const { mobileLayout = "cards", columns, className, scroll, ...rest } = props;
  const cards = isMobile && mobileLayout === "cards";
  const canFold = cards && props.pagination !== false;
  const [expanded, setExpanded] = useState<Set<Key>>(() => new Set());
  const keyOf = (record: T, index: number) =>
    typeof props.rowKey === "function"
      ? props.rowKey(record, index)
      : ((record as Record<string, Key>)[String(props.rowKey ?? "key")] ??
        (record as Record<string, Key>).id ??
        index);
  const decorate = (items: ColumnsType<T>): ColumnsType<T> =>
    items.map((column, columnIndex) => {
      if ("children" in column)
        return { ...column, children: decorate(column.children) };
      const label =
        typeof column.title === "function"
          ? String(column.key ?? "Chi tiết")
          : nodeText(column.title);
      const actions =
        /thao tác|hành động/i.test(label) ||
        /^(actions?|operation)$/i.test(String(column.key ?? ""));
      const important =
        /trạng thái|tình trạng|số tiền|số dư|công nợ|folio|tổng tiền|tổng dự|thành tiền|tồn kho/i.test(
          label,
        );
      return {
        ...column,
        ...(isCompact ? { fixed: undefined } : {}),
        ...(cards
          ? {
              width: undefined,
              minWidth: undefined,
              ellipsis: false,
              responsive: undefined,
            }
          : {}),
        onCell: (record: T, index?: number) => ({
          ...column.onCell?.(record, index),
          "data-label": label,
          "data-card-actions": actions || undefined,
          "data-card-important": important || undefined,
        }),
        ...(actions && cards && column.render
          ? {
              render: (value: unknown, record: T, index: number) => (
                <CardActions>
                  {column.render!(value, record, index) as ReactNode}
                </CardActions>
              ),
            }
          : canFold && columnIndex === 0 && items.length > 4
            ? {
                render: (value: unknown, record: T, index: number) => (
                  <div className="responsive-card-heading">
                    <div>
                      {column.render
                        ? (column.render(value, record, index) as ReactNode)
                        : (value as ReactNode)}
                    </div>
                    <Button
                      size="small"
                      type="link"
                      aria-expanded={expanded.has(keyOf(record, index))}
                      onClick={(event) => {
                        event.stopPropagation();
                        const key = keyOf(record, index);
                        setExpanded((old) => {
                          const next = new Set(old);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        });
                      }}
                    >
                      {expanded.has(keyOf(record, index))
                        ? "Thu gọn"
                        : "Chi tiết"}
                    </Button>
                  </div>
                ),
              }
            : {}),
      };
    });
  return (
    <Table<T>
      {...rest}
      rowClassName={(record, index, indent) =>
        [
          typeof props.rowClassName === "function"
            ? props.rowClassName(record, index, indent)
            : props.rowClassName,
          cards && expanded.has(keyOf(record, index))
            ? "responsive-card-expanded"
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      }
      columns={columns ? decorate(columns) : columns}
      scroll={cards ? undefined : scroll}
      className={[
        "responsive-table",
        cards ? "responsive-table--cards" : "",
        canFold ? "responsive-table--collapsible" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
