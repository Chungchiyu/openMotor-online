/**
 * Time-stepped 0-D internal ballistics: the gas mass in the chamber is a state. Ported from
 * sugar-ballistics (sbal/engine.py `Chamber`).
 *
 *     dm/dt = sum_i phi_i rho r_i A_b,i + mdot_igniter - mdot_nozzle,      p = m R T / V_free
 *
 * With every option off it reproduces openMotor's quasi-steady curve once the chamber has filled;
 * the options add what static tests show openMotor leaves out:
 *
 *   ignition  igniter gas, nozzle plug (burst pressure), flame spread over the core and, later, the
 *             segment ends (fraction of each surface burning, phi, rising at a rate ~ p^q / tau)
 *   tail-off  spread of the burnout web (geometry.ts), and blow-down of the chamber through the
 *             nozzle (unchoked below the critical pressure ratio)
 *   burn rate scale on a, optionally a smooth law across the propellant's bands
 *   losses    c* efficiency (on the propellant's ideal c*) and nozzle efficiency (on Cf), separately
 *
 * The design has one propellant, so sbal's per-grain propellant and burn-rate scale are not ported,
 * nor its variable-throat interface (diver-sim's pintle) or erosive burning (on hold in sbal).
 */
import * as nozzleMod from '../nozzle';
import { getCombustionProperties } from '../propellant';
import type { NozzleConfig, PropellantConfig } from '../types';
import type { MotorlibGeometry } from './geometry';
import type { EffectiveTransientOptions } from './options';
import { erf } from './specialFunctions';

const R_UNIV = 8314.46;

export function gammaFn(k: number): number {
  return Math.sqrt(k) * (2 / (k + 1)) ** ((k + 1) / (2 * (k - 1)));
}

interface CstarProps {
  /** Burn rate r = a p^n (with the blended law, a is already the rate at p and n = 0). */
  a: number;
  n: number;
  k: number;
  /** R T of the gas, such that c* = eta x c*_ideal. */
  rt: number;
  cstar: number;
}

/** (a, n, k, t, m) with r = a p^n continuous and smooth across the band edges: the log of the burn
 * rate and the gas properties blend from one band to the next with weight
 * 0.5 (1 + tanh(ln(p / p_edge) / width)). */
function blended(prop: PropellantConfig, p: number, width: number) {
  const tabs = [...prop.tabs].sort((x, y) => x.minPressure - y.minPressure);
  const lnp = Math.log(p);
  let lnR = Math.log(tabs[0].a) + tabs[0].n * lnp;
  let { k, t, m } = tabs[0];
  for (const tb of tabs.slice(1)) {
    const w = 0.5 * (1 + Math.tanh((lnp - Math.log(tb.minPressure)) / width));
    lnR = (1 - w) * lnR + w * (Math.log(tb.a) + tb.n * lnp);
    k = (1 - w) * k + w * tb.k;
    t = (1 - w) * t + w * tb.t;
    m = (1 - w) * m + w * tb.m;
  }
  return { a: Math.exp(lnR), n: 0, k, t, m };
}

/** Burn rate and gas properties at an absolute pressure; T_gas such that c* = eta x c*_ideal (t / 0.95). */
export function cstarProps(prop: PropellantConfig, pAbs: number, etaCstar: number, blend = 0): CstarProps {
  const { a, n, k, t, m } = blend > 0 && prop.tabs.length > 1 ? blended(prop, pAbs, blend) : getCombustionProperties(prop, pAbs);
  const r = R_UNIV / m;
  const gam = gammaFn(k);
  const cstarIdeal = Math.sqrt((r * t) / 0.95) / gam;
  const cstar = etaCstar * cstarIdeal;
  return { a, n, k, rt: (cstar * gam) ** 2, cstar };
}

/** Fraction of a surface burning after spread progress s: linear ramp over tau, or the normal CDF
 * of ignition times with mean tau / 2 and sigma tau / 4 (0 before s = 0). */
export function litFraction(s: number, tau: number, shape: 'linear' | 'smooth'): number {
  if (s <= 0) return 0;
  if (shape === 'smooth') return 0.5 * (1 + erf((s - 0.5 * tau) / (0.25 * tau * Math.SQRT2)));
  return Math.min(1, s / tau);
}

/** p_e / p_c on the supersonic branch for an expansion ratio (scipy's brentq in sbal; bisection
 * here, as eRatioFromPRatio rises monotonically from 0 to 1 over (0, critical ratio]). */
function exitPressureRatio(k: number, eps: number): number {
  const crit = (2 / (k + 1)) ** (k / (k - 1));
  if (eps <= 1) return crit;
  const target = 1 / eps;
  let lo = 1e-12;
  let hi = crit;
  for (let i = 0; i < 200 && hi - lo > 1e-15; i++) {
    const mid = 0.5 * (lo + hi);
    if (nozzleMod.eRatioFromPRatio(k, mid) < target) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export class Chamber {
  readonly o: EffectiveTransientOptions;
  readonly geo: MotorlibGeometry;
  readonly prop: PropellantConfig;
  readonly nGrains: number;
  readonly throat: number;
  readonly at: number;
  readonly eps: number;
  readonly vChamber: number;
  readonly mProp0: number;
  private readonly loss: number;
  private readonly lengthFactor: number;
  private readonly peCache = new Map<number, number>();

  /** Regression depth of each grain, m. */
  x: Float64Array;
  phiCore: Float64Array;
  phiEnd: Float64Array;
  /** Flame-spread progress [s at pRef, for the reference grain length]. */
  spread = 0;
  /** The nozzle is still plugged. */
  plug: boolean;
  t = 0;
  /** Absolute chamber pressure, Pa. */
  p: number;
  k: number;
  rt: number;
  vFree: number;
  mGas: number;
  /** Nozzle mass flow, kg/s. */
  mdot = 0;
  pMax = 0;
  burntOut = false;
  /** Gas generated by each grain in the last step, kg/s (forward end first). */
  generation: Float64Array;
  /** Lit and total burning area in the last step (initially at t = 0), m^2. */
  litArea = 0;
  totalArea = 0;

  constructor(prop: PropellantConfig, geometry: MotorlibGeometry, nozzle: NozzleConfig, opts: EffectiveTransientOptions) {
    const o = (this.o = opts);
    this.geo = geometry;
    this.prop = prop;
    const n = (this.nGrains = geometry.grains.length);
    this.throat = Math.max(nozzle.throat, 1e-6);
    this.at = (Math.PI / 4) * this.throat ** 2;
    this.eps = Math.max(nozzleMod.getExitArea(nozzle) / this.at, 1);
    this.loss = nozzleMod.getDivergenceLosses(nozzle) * nozzleMod.getThroatLosses(nozzle, 0);
    this.vChamber = geometry.envelopeVolume() + o.freeVolumeExtra;
    const totalLength = geometry.grains.reduce((sum, g) => sum + g.length, 0);
    this.lengthFactor = o.spreadRefLength > 0 ? totalLength / o.spreadRefLength : 1;
    this.x = new Float64Array(n);
    this.phiCore = new Float64Array(n).fill(o.instantIgnition ? 1 : 0);
    this.phiEnd = new Float64Array(n).fill(o.instantIgnition ? 1 : 0);
    this.plug = o.plugBurst > 0 && !o.instantIgnition;
    this.generation = new Float64Array(n);
    let vol0 = 0;
    for (let i = 0; i < n; i++) {
      const [aCore, aEnd, vol] = geometry.state(i, 0);
      vol0 += vol;
      this.totalArea += aCore + aEnd;
      this.litArea += this.phiCore[i] * aCore + this.phiEnd[i] * aEnd;
    }
    this.mProp0 = vol0 * prop.density;
    // initial gas: openMotor starts at the steady pressure; the transient starts at ambient
    this.p = o.instantIgnition ? this.steadyPressure() : o.pAmb;
    const props = cstarProps(prop, this.p, o.etaCstar);
    this.k = props.k;
    this.rt = props.rt;
    this.vFree = this.vChamber - vol0;
    this.mGas = (this.p * this.vFree) / this.rt;
  }

  // --- nozzle -------------------------------------------------------------------------------------
  private pe(k: number): number {
    const key = Math.round(k * 1e5);
    let ratio = this.peCache.get(key);
    if (ratio === undefined) {
      ratio = exitPressureRatio(k, this.eps);
      this.peCache.set(key, ratio);
    }
    return ratio;
  }

  /** p_e / p_c for the current gas. */
  exitPressureRatio(): number {
    return this.pe(this.k);
  }

  /** openMotor's adjusted Cf (efficiency 1) at chamber pressure pAbs. */
  cf(pAbs: number, k: number, pAmb: number): number {
    const pr = this.pe(k);
    const mom = Math.sqrt(((2 * k * k) / (k - 1)) * (2 / (k + 1)) ** ((k + 1) / (k - 1)) * (1 - pr ** ((k - 1) / k)));
    return this.loss * (0.99 * (mom + (pr - pAmb / pAbs) * this.eps) + 0.01);
  }

  /** Choked: p A_t / c*; below the critical ratio, isentropic subsonic flow to ambient. */
  mdotNozzle(pAbs: number, k: number, rt: number, pAmb: number): number {
    if (pAbs <= pAmb) return 0;
    if (pAbs / pAmb >= ((k + 1) / 2) ** (k / (k - 1))) return (pAbs * this.at * gammaFn(k)) / Math.sqrt(rt);
    const pr = pAmb / pAbs;
    return pAbs * this.at * Math.sqrt(((2 * k) / ((k - 1) * rt)) * (pr ** (2 / k) - pr ** ((k + 1) / k)));
  }

  thrust(pAmb = this.o.pAmb): number {
    if (this.plug || this.p <= pAmb) return 0;
    return Math.max(0, this.o.etaNozzle * this.cf(this.p, this.k, pAmb) * this.p * this.at);
  }

  // --- state ---------------------------------------------------------------------------------------
  grainMasses(): number[] {
    return Array.from({ length: this.nGrains }, (_, i) => this.geo.state(i, this.x[i])[2] * this.prop.density);
  }

  /** Quasi-steady absolute chamber pressure [Pa] for the current grain: generation = nozzle flow,
   * by fixed-point iteration on p. */
  steadyPressure(): number {
    const o = this.o;
    let area = 0;
    for (let i = 0; i < this.nGrains; i++) {
      const [aCore, aEnd] = this.geo.state(i, this.x[i]);
      area += this.phiCore[i] * aCore + this.phiEnd[i] * aEnd;
    }
    if (area <= 0) return 0;
    let p = 3e6;
    for (let iter = 0; iter < 80; iter++) {
      const { a, n, k, rt } = cstarProps(this.prop, p, o.etaCstar, o.bandBlend);
      const gen = this.prop.density * o.burnRateScale * a * p ** n * area;
      const pNew = (gen * Math.sqrt(rt)) / (this.at * gammaFn(k));
      if (Math.abs(pNew - p) < 1) return pNew;
      p = Math.sqrt(p * pNew);
    }
    return p;
  }

  // --- step ----------------------------------------------------------------------------------------
  step(dt: number, pAmb = this.o.pAmb): void {
    const o = this.o;
    const n = this.nGrains;
    let p = this.p;
    const rho = this.prop.density;
    const props = cstarProps(this.prop, p, o.etaCstar, o.bandBlend);
    const r = o.burnRateScale * props.a * p ** props.n;
    const rates = new Float64Array(n);
    let gen = 0;
    let vols = 0;
    let litArea = 0;
    let totalArea = 0;
    for (let i = 0; i < n; i++) {
      // forward end first, as openMotor
      const [aCore, aEnd, vol] = this.geo.state(i, this.x[i]);
      vols += vol;
      const ab = this.phiCore[i] * aCore + this.phiEnd[i] * aEnd;
      // while part of the surface is unlit, regress by the lit fraction (an average over the
      // surface) so that the propellant consumed equals the gas generated
      rates[i] = r * (aCore + aEnd > 0 ? ab / (aCore + aEnd) : 0);
      const mg = rho * r * ab;
      this.generation[i] = mg;
      gen += mg;
      litArea += ab;
      totalArea += aCore + aEnd;
    }
    this.litArea = litArea;
    this.totalArea = totalArea;
    const k = gen > 0 ? props.k : this.k;
    const rt = gen > 0 ? props.rt : this.rt;
    let ig = 0;
    if (!o.instantIgnition && o.igniterTime > 0) {
      const ig0 = (o.igniterPressure * this.at * gammaFn(k)) / Math.sqrt(rt);
      if (o.igniterProfile === 'decay') ig = ig0 * Math.exp(-this.t / o.igniterTime);
      else if (this.t < o.igniterTime) ig = ig0;
    }
    const vFree = this.vChamber - vols;
    // nozzle: closed until the plug bursts; implicit in m for the choked branch
    if (this.plug && p - pAmb >= o.plugBurst) this.plug = false;
    let md: number;
    if (this.plug) {
      this.mGas += (gen + ig) * dt;
      md = 0;
    } else if (p / pAmb >= ((k + 1) / 2) ** (k / (k - 1))) {
      const c = (this.at * gammaFn(k) * Math.sqrt(rt)) / vFree; // mdot = c m
      this.mGas = (this.mGas + (gen + ig) * dt) / (1 + c * dt);
      md = c * this.mGas;
    } else {
      md = this.mdotNozzle(p, k, rt, pAmb);
      this.mGas = Math.max(this.mGas + (gen + ig - md) * dt, (pAmb * vFree) / rt);
    }
    p = this.p = (this.mGas * rt) / vFree;
    this.k = k;
    this.rt = rt;
    this.vFree = vFree;
    this.mdot = md;
    this.pMax = Math.max(this.pMax, p);
    for (let i = 0; i < n; i++) this.x[i] += rates[i] * dt;
    if (!o.instantIgnition) {
      this.spread += (((Math.max(p, pAmb) / o.pRef) ** o.spreadExponent) * dt) / this.lengthFactor;
      this.phiCore.fill(litFraction(this.spread, o.tauCore, o.ignitionShape));
      this.phiEnd.fill(litFraction(this.spread - o.endStart * o.tauCore, o.tauEnd, o.ignitionShape));
    }
    this.t += dt;
    if (!this.burntOut && vols <= 0) this.burntOut = true;
  }

  /** Burnt out and blown down (gauge pressure below 0.2 % of the peak). */
  get done(): boolean {
    return this.burntOut && this.p - this.o.pAmb < 0.002 * this.pMax;
  }
}
