import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { PropellantConfig } from '../physics/types';
import { loadLibrary, saveLibrary, uniqueName } from '../propellantLibrary';

interface LibraryApi {
  library: PropellantConfig[];
  /** Replaces the entry that was named `originalName` with `updated` (renames are allowed). */
  updatePropellant: (originalName: string, updated: PropellantConfig) => void;
  addPropellant: (p: PropellantConfig) => void;
  /** Adds several propellants in one update — calling `addPropellant` in a loop drops all but the
   * last, since each call closes over the same pre-loop `library` value (React batches the
   * `setState` calls in between). */
  addPropellants: (list: PropellantConfig[]) => void;
  deletePropellant: (name: string) => void;
}

const Ctx = createContext<LibraryApi | null>(null);

export function PropellantLibraryProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<PropellantConfig[]>(() => loadLibrary());

  const persist = (next: PropellantConfig[]) => {
    setLibrary(next);
    saveLibrary(next);
  };

  const api = useMemo<LibraryApi>(
    () => ({
      library,
      updatePropellant: (originalName, updated) => {
        persist(library.map((p) => (p.name === originalName ? updated : p)));
      },
      addPropellant: (p) => {
        persist([...library, { ...p, name: uniqueName(library, p.name) }]);
      },
      addPropellants: (list) => {
        let next = library;
        for (const p of list) {
          next = [...next, { ...p, name: uniqueName(next, p.name) }];
        }
        persist(next);
      },
      deletePropellant: (name) => {
        persist(library.filter((p) => p.name !== name));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePropellantLibrary(): LibraryApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePropellantLibrary must be used within a PropellantLibraryProvider');
  return ctx;
}
