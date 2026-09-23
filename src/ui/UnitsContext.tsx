import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { getAllConversions, unitLabels } from '../physics/units';

const STORAGE_KEY = 'openmotor-online:unitPrefs:v1';
const PRECISION_STORAGE_KEY = 'openmotor-online:statsPrecision:v1';
const DEFAULT_PRECISION = 2;
const MIN_PRECISION = 0;
const MAX_PRECISION = 6;

/** One entry per quantity type in unitLabels (motorlib/units.py's `unitLabels`) — mirrors the
 * original desktop app's Preferences dialog, which lets each physical quantity (not just length)
 * be displayed/edited in whichever unit the user prefers. */
export type UnitPrefs = Record<string, string>;

function defaultPrefs(): UnitPrefs {
  // A metric-leaning default set, close to what a small-motor hobbyist would expect; "m" itself
  // is too coarse for these part sizes, so length defaults to mm rather than the canonical unit.
  return {
    m: 'mm',
    'm^3': 'cm^3',
    'm/s': 'm/s',
    N: 'N',
    Ns: 'Ns',
    Pa: 'MPa',
    kg: 'g',
    'kg/m^3': 'kg/m^3',
    'kg/s': 'kg/s',
    'kg/(m^2*s)': 'kg/(m^2*s)',
  };
}

function loadPrefs(): UnitPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultPrefs(), ...(JSON.parse(raw) as UnitPrefs) };
  } catch {
    // fall through to defaults
  }
  return defaultPrefs();
}

function clampPrecision(n: number): number {
  return Math.min(MAX_PRECISION, Math.max(MIN_PRECISION, Math.round(n)));
}

function loadPrecision(): number {
  try {
    const raw = window.localStorage.getItem(PRECISION_STORAGE_KEY);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n)) return clampPrecision(n);
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_PRECISION;
}

interface Ctx {
  prefs: UnitPrefs;
  setUnit: (canonical: string, display: string) => void;
  /** The chosen display unit for a canonical (SI) unit, e.g. unitFor('Pa') -> 'MPa'. Falls back to
   * the canonical unit itself if there's no preference recorded for it. */
  unitFor: (canonical: string) => string;
  /** Number of decimal places shown for Motor Statistics values (Preferences dialog). */
  precision: number;
  setPrecision: (precision: number) => void;
}

const UnitsCtx = createContext<Ctx | null>(null);

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UnitPrefs>(() => loadPrefs());
  const [precision, setPrecisionState] = useState<number>(() => loadPrecision());

  const value = useMemo<Ctx>(
    () => ({
      prefs,
      setUnit: (canonical, display) => {
        setPrefs((prev) => {
          const next = { ...prev, [canonical]: display };
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            // best-effort persistence only
          }
          return next;
        });
      },
      unitFor: (canonical) => prefs[canonical] ?? canonical,
      precision,
      setPrecision: (next) => {
        const clamped = clampPrecision(next);
        setPrecisionState(clamped);
        try {
          window.localStorage.setItem(PRECISION_STORAGE_KEY, String(clamped));
        } catch {
          // best-effort persistence only
        }
      },
    }),
    [prefs, precision],
  );

  return <UnitsCtx.Provider value={value}>{children}</UnitsCtx.Provider>;
}

export function useUnits(): Ctx {
  const ctx = useContext(UnitsCtx);
  if (!ctx) throw new Error('useUnits must be used within a UnitsProvider');
  return ctx;
}

/** All quantity types that have a chooseable unit (mirrors motorlib/units.py's `unitLabels`), each
 * with the display-name label and the list of units it can be shown in. */
export function quantityTypes(): { canonical: string; label: string; options: string[] }[] {
  return Object.entries(unitLabels).map(([canonical, label]) => ({
    canonical,
    label,
    options: getAllConversions(canonical),
  }));
}

// Kept for the two call sites that only ever dealt with length before this was generalized.
export type LengthUnit = string;
