import { useCallback, useRef, useState } from 'react';

/**
 * Generic undo/redo history for a piece of state, backing the Edit > Undo/Redo menu (the original
 * desktop app supports undo/redo on the motor being edited; this MVP didn't have it at all before).
 * `set` both updates the current value and pushes a new history entry; `replace` updates the
 * current value WITHOUT growing history (used for high-frequency changes you don't want a whole
 * undo step for — nothing currently needs it, but it's here for that reason).
 */
export function useHistory<T>(initial: T | (() => T)) {
  const [value, setValue] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, forceRender] = useState(0);

  const set = useCallback((updater: (prev: T) => T) => {
    setValue((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      past.current.push(prev);
      future.current = [];
      return next;
    });
  }, []);

  const reset = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    setValue(next);
  }, []);

  const undo = useCallback(() => {
    setValue((current) => {
      const prev = past.current.pop();
      if (prev === undefined) return current;
      future.current.push(current);
      forceRender((n) => n + 1);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setValue((current) => {
      const next = future.current.pop();
      if (next === undefined) return current;
      past.current.push(current);
      forceRender((n) => n + 1);
      return next;
    });
  }, []);

  return {
    value,
    set,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
