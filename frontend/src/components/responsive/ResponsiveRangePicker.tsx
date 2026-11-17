import { useState } from "react";
import { DatePicker } from "antd";
import type { RangePickerProps } from "antd/es/date-picker";
import type { Dayjs } from "dayjs";
import { useResponsiveLayout } from "./useResponsiveLayout.ts";

type Value = [Dayjs | null, Dayjs | null] | null;
const signature = (value: Value | undefined) =>
  value?.map((day) => day?.valueOf() ?? "").join(":") ?? "";
export function ResponsiveRangePicker(props: RangePickerProps) {
  const { isMobile } = useResponsiveLayout();
  const controlled = props.value !== undefined;
  const [draft, setDraft] = useState<Value>(
    (props.value ?? props.defaultValue ?? null) as Value,
  );
  const [previous, setPrevious] = useState(signature(props.value as Value));
  const current = signature(props.value as Value);
  if (previous !== current) {
    setPrevious(current);
    setDraft((props.value ?? null) as Value);
  }
  const value =
    controlled && props.value?.[0] && props.value?.[1]
      ? (props.value as Value)
      : draft;
  const notify = (next: Value) => {
    if (!controlled || !props.value?.[0] || !props.value?.[1]) setDraft(next);
    const format =
      typeof props.format === "string" ? props.format : "YYYY-MM-DD";
    props.onChange?.(
      next as Parameters<NonNullable<RangePickerProps["onChange"]>>[0],
      next
        ? [next[0]?.format(format) ?? "", next[1]?.format(format) ?? ""]
        : ["", ""],
    );
  };
  if (!isMobile)
    return (
      <DatePicker.RangePicker
        {...props}
        value={value}
        onChange={(next, strings) => {
          setDraft(next as Value);
          props.onChange?.(next, strings);
        }}
      />
    );
  const choose = (day: Dayjs | null, index: number) => {
    if (!day) {
      setDraft(null);
      notify(null);
      return;
    }
    const next: Value = [value?.[0] ?? null, value?.[1] ?? null];
    next[index] = day;
    // RangePicker orders complete ranges by default. Keep the same rule with two calendars.
    if (next[0] && next[1]) {
      if (props.order !== false && next[0].isAfter(next[1])) next.reverse();
      notify(next);
    } else setDraft(next);
  };
  return (
    <div
      className={`responsive-date-range ${props.className ?? ""}`}
      style={props.style}
    >
      {([0, 1] as const).map((index) => (
        <label key={index}>
          <span>
            {props.placeholder?.[index] ||
              (index === 0 ? "Từ ngày" : "Đến ngày")}
          </span>
          <DatePicker
            value={value?.[index] ?? null}
            onChange={(day) => choose(day, index)}
            id={
              typeof props.id === "string"
                ? index === 0
                  ? props.id
                  : undefined
                : index === 0
                  ? props.id?.start
                  : props.id?.end
            }
            format={props.format}
            allowClear={props.allowClear ?? true}
            disabled={
              Array.isArray(props.disabled)
                ? props.disabled[index]
                : props.disabled
            }
            disabledDate={props.disabledDate}
            minDate={props.minDate}
            maxDate={props.maxDate}
            inputReadOnly={props.inputReadOnly}
            size={props.size}
            status={props.status}
            variant={props.variant}
            aria-label={
              props.placeholder?.[index] ||
              (index === 0 ? "Từ ngày" : "Đến ngày")
            }
            placeholder={
              props.placeholder?.[index] ||
              (index === 0 ? "Từ ngày" : "Đến ngày")
            }
          />
        </label>
      ))}
    </div>
  );
}
