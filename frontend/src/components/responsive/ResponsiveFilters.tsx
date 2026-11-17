import { useState, type ReactNode } from "react";
import { Button } from "antd";
import { FilterOutlined } from "@ant-design/icons";

/** Keep the filter subtree mounted so closing it or resizing never loses a draft. */
export function ResponsiveFilters({
  children,
  activeCount = 0,
  onReset,
}: {
  children: ReactNode;
  activeCount?: number;
  onReset?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={`responsive-filters ${expanded ? "responsive-filters--open" : ""}`}
    >
      <div className="responsive-filter-toggle">
        <Button
          icon={<FilterOutlined />}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          Bộ lọc{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
        {onReset && activeCount > 0 && (
          <Button type="link" onClick={onReset}>
            Xóa bộ lọc
          </Button>
        )}
      </div>
      <div className="responsive-filter-content">{children}</div>
    </div>
  );
}
