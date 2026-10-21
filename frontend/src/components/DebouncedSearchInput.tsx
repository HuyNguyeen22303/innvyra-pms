import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from 'antd';
import type { InputProps } from 'antd';

export interface DebouncedSearchInputProps extends Omit<InputProps, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  debounceMs?: number;
}

/**
 * Search input that keeps typing/clearing instant locally while debouncing the
 * expensive parent update (query + table render).
 *
 * - The input value is updated immediately.
 * - Parent callbacks are debounced, including the clear button, so clearing does
 *   not synchronously re-render the whole page.
 * - Enter still applies the current value immediately.
 * - External value changes (filter reset, programmatic navigation) cancel any
 *   pending debounce and sync the local input.
 */
export const DebouncedSearchInput: React.FC<DebouncedSearchInputProps> = React.memo(({
  value: externalValue = '',
  onChange,
  debounceMs = 350,
  onPressEnter,
  ...restProps
}) => {
  const [innerValue, setInnerValue] = useState<string>(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCallbackRef = useRef(onChange);
  // The last value emitted to the parent. Used to distinguish the parent echoing
  // our own change from an external reset while a newer local edit is pending.
  const lastEmittedValueRef = useRef<string>(externalValue);

  useEffect(() => {
    latestCallbackRef.current = onChange;
  }, [onChange]);

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Sync only when the parent value did not originate from this input. This
  // avoids overwriting newer local typing with the previous debounced value.
  useEffect(() => {
    if (externalValue === lastEmittedValueRef.current) {
      return;
    }

    lastEmittedValueRef.current = externalValue;
    clearPendingTimer();
    setInnerValue(externalValue);
  }, [externalValue, clearPendingTimer]);

  useEffect(() => {
    return () => {
      clearPendingTimer();
    };
  }, [clearPendingTimer]);

  const emitChange = useCallback((value: string) => {
    lastEmittedValueRef.current = value;
    latestCallbackRef.current?.(value);
  }, []);

  const scheduleChange = useCallback((value: string) => {
    clearPendingTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      emitChange(value);
    }, debounceMs);
  }, [clearPendingTimer, debounceMs, emitChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInnerValue(val);
    scheduleChange(val);
  }, [scheduleChange]);

  const handlePressEnter = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    clearPendingTimer();
    emitChange(innerValue);
    onPressEnter?.(e);
  }, [clearPendingTimer, emitChange, innerValue, onPressEnter]);

  return (
    <Input
      {...restProps}
      value={innerValue}
      onChange={handleChange}
      onPressEnter={handlePressEnter}
    />
  );
});

DebouncedSearchInput.displayName = 'DebouncedSearchInput';
