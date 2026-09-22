import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type LengthUnit = 'mm' | 'cm' | 'in' | 'm';

const UnitsContext = createContext<{ lengthUnit: LengthUnit; setLengthUnit: (u: LengthUnit) => void } | null>(null);

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>('mm');
  const value = useMemo(() => ({ lengthUnit, setLengthUnit }), [lengthUnit]);
  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error('useUnits must be used within a UnitsProvider');
  return ctx;
}
