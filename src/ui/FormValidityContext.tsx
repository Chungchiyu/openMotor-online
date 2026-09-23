import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface FormValidityContextValue {
  setFieldValid: (id: string, valid: boolean) => void;
  isValid: boolean;
}

const FormValidityContext = createContext<FormValidityContextValue | null>(null);

/**
 * Wraps a form whose Apply/Save/Export button must be disabled while any `NumberField` inside it
 * is empty or otherwise unparseable — each `NumberField` registers its own validity under a unique
 * id (see `useFieldValidity`), and `isValid` is true only once every registered field reports
 * valid. A `NumberField` used outside any provider (there shouldn't be any, but just in case)
 * simply doesn't register anywhere and never blocks anything.
 */
export function FormValidityProvider({ children }: { children: ReactNode }) {
  const invalidFields = useRef<Set<string>>(new Set());
  const [isValid, setIsValid] = useState(true);

  const setFieldValid = useCallback((id: string, valid: boolean) => {
    const invalid = invalidFields.current;
    if (valid) invalid.delete(id);
    else invalid.add(id);
    setIsValid(invalid.size === 0);
  }, []);

  const value = useMemo(() => ({ setFieldValid, isValid }), [setFieldValid, isValid]);

  return <FormValidityContext.Provider value={value}>{children}</FormValidityContext.Provider>;
}

/** Reads whether every field registered in the nearest enclosing `FormValidityProvider` is valid
 * — used by that form's Apply/Save/Export button to decide whether it can be clicked. Defaults to
 * `true` (never blocks) when there's no provider above it. */
export function useFormIsValid(): boolean {
  return useContext(FormValidityContext)?.isValid ?? true;
}

/** Registers one field's validity under `id` with the nearest enclosing `FormValidityProvider`,
 * and unregisters it (as valid, so it can't leave the form stuck disabled) on unmount — needed
 * because, e.g., switching grain type swaps which fields are rendered entirely. */
export function useFieldValidity(id: string, valid: boolean): void {
  const ctx = useContext(FormValidityContext);
  useEffect(() => {
    ctx?.setFieldValid(id, valid);
  }, [ctx, id, valid]);
  useEffect(() => {
    return () => ctx?.setFieldValid(id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, id]);
}
