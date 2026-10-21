import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Input } from 'antd';
import type { InputProps } from 'antd';

export interface DebouncedSearchInputProps extends Omit<InputProps, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  debounceMs?: number;
  /**
   * Run the debounced parent update inside a React transition, so the resulting
   * re-render (query + table) is interruptible. Holding Backspace fires a key
   * repeat every ~30ms; a normal-priority render of the result list would delay
   * the next keydown, which stretches the debounce gap until it expires and
   * starts another expensive render (a feedback loop that shows up as hundreds
   * of milliseconds of INP). A transition lets React hand the thread back to the
   * keystroke immediately.
   */
  deferUpdate?: boolean;
  /**
   * Apply an empty value to the parent right away instead of waiting for the
   * typing debounce. Clearing a filter is an explicit action, so it should not
   * be delayed by the debounce that protects continuous typing.
   */
  clearImmediately?: boolean;
  /**
   * Notified while a debounced update is still waiting to be applied, so the
   * page can show that the result list is being refreshed.
   */
  onPendingChange?: (pending: boolean) => void;
}

/**
 * Search input that keeps typing/clearing instant locally while debouncing the
 * expensive parent update (query + table render).
 *
 * - The input value is updated immediately.
 * - Parent callbacks are debounced, including the clear button, so clearing does
 *   not synchronously re-render the whole page.
 * - The debounced update runs in a transition, so a burst of keystrokes (or a
 *   held Backspace) can interrupt the result-list re-render instead of waiting
 *   for it. See `deferUpdate`.
 * - Typing a value that we already emitted is a no-op: the parent is not asked
 *   to rebuild the list it is already showing.
 * - Enter still applies the current value immediately.
 * - External value changes (filter reset, programmatic navigation) cancel any
 *   pending debounce and sync the local input.
 */
export const DebouncedSearchInput: React.FC<DebouncedSearchInputProps> = React.memo(({
  value: externalValue = '',
  onChange,
  debounceMs = 100,
  deferUpdate = true,
  clearImmediately = false,
  onPendingChange,
  onPressEnter,
  ...restProps
}) => {
  const [innerValue, setInnerValue] = useState<string>(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCallbackRef = useRef(onChange);
  // The last value emitted to the parent. Used to distinguish the parent echoing
  // our own change from an external reset while a newer local edit is pending.
  const lastEmittedValueRef = useRef<string>(externalValue);
  // Pending state lives in a ref: the parent only needs to know that an update
  // is waiting, not to re-render on every keystroke.
  const pendingRef = useRef(false);
  const pendingCallbackRef = useRef<((pending: boolean) => void) | undefined>(onPendingChange);

  useEffect(() => {
    latestCallbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    pendingCallbackRef.current = onPendingChange;
  }, [onPendingChange]);

  const setPending = useCallback((pending: boolean) => {
    if (pendingRef.current === pending) return;
    pendingRef.current = pending;
    pendingCallbackRef.current?.(pending);
  }, []);

  // Cancel the pending timer only. Kept separate from clearPendingTimer so a
  // keystroke that reschedules the debounce does not flap the pending flag
  // (false -> true) on every single character.
  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearPendingTimer = useCallback(() => {
    cancelTimer();
    setPending(false);
  }, [cancelTimer, setPending]);

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
      // Never notify the parent while unmounting.
      pendingCallbackRef.current = undefined;
      clearPendingTimer();
    };
  }, [clearPendingTimer]);

  const emitChange = useCallback((value: string) => {
    // The parent already holds this value (e.g. the user typed a character and
    // deleted it again). Re-emitting would re-run the whole filtered render for
    // no visible change, so skip it.
    const unchanged = value === lastEmittedValueRef.current;
    lastEmittedValueRef.current = value;
    setPending(false);
    if (unchanged) return;

    if (deferUpdate) {
      // Low priority: React may interrupt this render when the next keydown
      // arrives, keeping the caret and the held Backspace responsive.
      startTransition(() => latestCallbackRef.current?.(value));
    } else {
      latestCallbackRef.current?.(value);
    }
  }, [deferUpdate, setPending]);

  const scheduleChange = useCallback((value: string) => {
    cancelTimer();
    setPending(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      emitChange(value);
    }, debounceMs);
  }, [cancelTimer, debounceMs, emitChange, setPending]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInnerValue(val);
    if (clearImmediately && val === '') {
      // Clearing is an explicit action: apply it now instead of waiting for the
      // typing debounce to elapse.
      clearPendingTimer();
      emitChange('');
      return;
    }
    scheduleChange(val);
  }, [clearImmediately, clearPendingTimer, emitChange, scheduleChange]);

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
