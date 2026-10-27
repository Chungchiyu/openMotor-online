/**
 * Grain geometry for the transient model. Ported from sugar-ballistics (sbal/engine.py
 * `MotorlibGeometry`): any grain (BATES, end burner, FMM, custom ...) with the tail-off as a spread
 * of burnout webs. Grain i is the mean of copies whose regression is scaled by f_k = 1 + delta_k
 * (delta normally distributed, sigma = ecc / 2, at fixed quantiles); f_k V(x / f_k) keeps
 * dV/dx = A(x / f_k), so mass is conserved and the mean volume is the grain's. The core / end split
 * (for the flame spread) is the grain's core surface area for perforated grains; other grains count
 * as core (lit first). Tabulated once per distinct grain; the grains must be set up
 * (`simulationSetup`), as `Motor` does.
 */
import type { Grain } from '../grains/base';
import { PerforatedGrain } from '../grains/base';
import { ndtri } from './specialFunctions';

const N_QUANTILES = 15;
const N_TABLE = 1500;
/** m: cap on the absolute spread (sigma) of the burnout web. The relative spread was fitted to BATES
 * webs of 10-30 mm (sigma up to ~2.8 mm); applied to an end burner's whole length it would stretch
 * the tail-off far beyond anything tested. */
const MAX_SIGMA = 3.0e-3;

interface GrainTable {
  /** Uniform regression grid from 0 to just past the web: xs[j] = j * step. */
  step: number;
  core: Float64Array;
  end: Float64Array;
  vol: Float64Array;
  web: number;
}

/** (core area, end area, propellant volume, web left) of a grain at a regression depth. */
export type GrainState = [number, number, number, number];

/** `np.interp` on the table's uniform grid (clamped at both ends). */
function interp(table: GrainTable, values: Float64Array, x: number): number {
  const pos = x / table.step;
  if (pos <= 0) return values[0];
  const last = values.length - 1;
  if (pos >= last) return values[last];
  const j = Math.floor(pos);
  const frac = pos - j;
  return values[j] + frac * (values[j + 1] - values[j]);
}

/** Regression depth at which a grain is gone. */
function grainWeb(g: Grain): number {
  let lo = 0;
  let hi = Math.max(g.diameter, g.length);
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (g.getVolumeAtRegression(mid) > 1e-12 && g.getWebLeft(mid) > 0) lo = mid;
    else hi = mid;
  }
  return hi;
}

function tabulate(g: Grain): GrainTable {
  const web = Math.max(grainWeb(g), 1e-6);
  const step = (web * 1.0005) / (N_TABLE - 1);
  const core = new Float64Array(N_TABLE);
  const end = new Float64Array(N_TABLE);
  const vol = new Float64Array(N_TABLE);
  for (let j = 0; j < N_TABLE; j++) {
    const x = j * step;
    const total = g.getSurfaceAreaAtRegression(x);
    const c = g instanceof PerforatedGrain ? g.getCoreSurfaceArea(x) : total;
    const coreClipped = Math.min(Math.max(c, 0), total);
    core[j] = coreClipped;
    end[j] = total - coreClipped;
    vol[j] = g.getVolumeAtRegression(x);
  }
  return { step, core, end, vol, web };
}

export class MotorlibGeometry {
  grains: Grain[];
  private tables: GrainTable[] = [];
  private factors: Float64Array[] = [];

  /** `keys[i]` identifies grain i's shape (identical grains share a table). */
  constructor(grains: Grain[], keys: string[], ecc = 0) {
    this.grains = grains;
    const q = ecc > 0 ? Array.from({ length: N_QUANTILES }, (_, k) => ndtri((k + 0.5) / N_QUANTILES)) : [0];
    const cache = new Map<string, GrainTable>();
    grains.forEach((g, i) => {
      let table = cache.get(keys[i]);
      if (!table) {
        table = tabulate(g);
        cache.set(keys[i], table);
      }
      this.tables.push(table);
      const sigma = ecc > 0 ? Math.min(0.5 * ecc, MAX_SIGMA / table.web) : 0;
      this.factors.push(Float64Array.from(q, (qk) => Math.max(1 + sigma * qk, 0.05)));
    });
  }

  state(i: number, x: number): GrainState {
    const t = this.tables[i];
    const f = this.factors[i];
    let aCore = 0;
    let aEnd = 0;
    let v = 0;
    let webLeft = 0;
    for (let k = 0; k < f.length; k++) {
      const xr = x / f[k];
      webLeft = Math.max(webLeft, f[k] * (t.web - xr));
      if (xr >= t.web) continue;
      aCore += interp(t, t.core, xr);
      aEnd += interp(t, t.end, xr);
      v += f[k] * interp(t, t.vol, xr);
    }
    const n = f.length;
    return [aCore / n, aEnd / n, v / n, webLeft];
  }

  envelopeVolume(): number {
    return this.grains.reduce((sum, g) => sum + g.getGrainBoundingVolume(), 0);
  }
}
