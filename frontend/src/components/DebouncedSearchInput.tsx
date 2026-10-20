import React, { useState, useEffect, useRef } from 'react';
import { Input } from 'antd';
import type { InputProps } from 'antd';

export interface DebouncedSearchInputProps extends Omit<InputProps, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  debounceMs?: number;
}

/**
 * High-performance search input that isolates local typing state from the parent page.
 * Prevents triggering expensive parent re-renders and redundant API queries on every keystroke.
 * - Typing updates local state immediately (0ms UI latency, cursor preserved).
 * - Debounces callback to parent (default 350ms).
 * - Immediately triggers on Enter keypress or clear button click.
 * - Cancels pending debounce when externally reset to prevent race conditions.
 */
export const DebouncedSearchInput: React.FC<DebouncedSearchInputProps> = React.memo(({
  value: externalValue = '',
  onChange,
  debounceMs = 350,
  onPressEnter,
  ...restProps
}) => {
  const [innerValue, setInnerValue] = useState<string>(externalValue);
  const [prevExternalValue, setPrevExternalValue] = useState<string>(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCallbackRef = useRef(onChange);

  // Update latest callback ref in an effect (not during render)
  useEffect(() => {
    latestCallbackRef.current = onChange;
  });

  // Keep innerValue in sync if externalValue changes from outside without cascading effect
  if (externalValue !== prevExternalValue) {
    setPrevExternalValue(externalValue);
    setInnerValue(externalValue);
  }

  // Cancel any pending debounce timer if external value changed
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, [externalValue]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInnerValue(val);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // If user cleared the input (empty string), notify immediately
    if (val === '') {
      latestCallbackRef.current?.('');
      return;
    }

    timerRef.current = setTimeout(() => {
      latestCallbackRef.current?.(val);
    }, debounceMs);
  };

  const handlePressEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    latestCallbackRef.current?.(innerValue);
    onPressEnter?.(e);
  };

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
