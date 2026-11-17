import { useState } from "react";
import { Select, Tabs, type TabsProps } from "antd";
import { nodeText } from "./responsiveText.ts";

/** Only navigation changes at the breakpoint. The same tab panes remain mounted. */
export function ResponsiveTabs({ className, ...props }: TabsProps) {
  const items = props.items ?? [];
  const [localKey, setLocalKey] = useState(
    props.defaultActiveKey ?? items.find((item) => !item.disabled)?.key,
  );
  const activeKey = props.activeKey ?? localKey;
  const change = (key: string) => {
    setLocalKey(key);
    props.onChange?.(key);
  };
  return (
    <div className="responsive-tabs">
      <Select
        className="responsive-tab-select"
        aria-label="Chọn mục hiển thị"
        value={activeKey}
        onChange={change}
        options={items.map((item) => ({
          value: item.key,
          label: item.label,
          "aria-label": nodeText(item.label).trim(),
          disabled: item.disabled,
        }))}
      />
      <Tabs
        {...props}
        className={className}
        activeKey={activeKey}
        onChange={change}
      />
    </div>
  );
}
