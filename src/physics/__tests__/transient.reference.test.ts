/**
 * The transient model (physics/transient/) against golden values from the Python original:
 * sugar-ballistics' Chamber + MotorlibGeometry on motorlib grains, the way diver-sim flies .ric
 * motors (scripts/transient_reference.py writes ref_transient.json). Covers the validated preset on
 * BATES, Moon Burner (FMM) and End Burner grains, every effect off, and every option set at once on a
 * five-band propellant (smooth burn-rate law, decaying igniter, nozzle plug, calibration).
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import type { SimulationResult } from '../simResult';
import { defaultTransientOptions, type TransientSettings } from '../transient/options';
import { runTransientChunked } from '../transient/run';
import type { MotorDesign } from '../types';
import refTransient from '../__fixtures__/ref_transient.json';
import refSimple from '../__fixtures__/ref_simple.json';
import refKnsb from '../__fixtures__/ref_knsb.json';
import refMoon from '../__fixtures__/ref_moon.json';
import refEndBurner from '../__fixtures__/ref_endburner.json';

interface Case {
  fixture: string;
  settings: Omit<TransientSettings, 'enabled' | 'compareBaseline' | 'options'> & { options: Partial<TransientSettings['options']> };
  t: number[];
  p: number[];
  f: number[];
  mProp0: number;
  pMax: number;
  impulse: number;
  burnTime: number;
  massBalance: number;
}
const cases = refTransient as Record<string, Case>;
const fixtures: Record<string, { motorDict: unknown }> = {
  'ref_simple.json': refSimple,
  'ref_knsb.json': refKnsb,
  'ref_moon.json': refMoon,
  'ref_endburner.json': refEndBurner,
};

function settingsOf(ref: Case): TransientSettings {
  return { ...ref.settings, enabled: true, compareBaseline: false, options: { ...defaultTransientOptions(), ...ref.settings.options } };
}

async function run(ref: Case, compareBaseline = false): Promise<SimulationResult> {
  const design = fixtures[ref.fixture].motorDict as MotorDesign;
  const result = await runTransientChunked(design, { ...settingsOf(ref), compareBaseline }, () => {}, () => false);
  if (!result) throw new Error('unexpectedly cancelled');
  return result;
}

function interp(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  let i = 1;
  while (i < xs.length - 1 && xs[i] < x) i++;
  const f = Math.min(1, (x - xs[i - 1]) / (xs[i] - xs[i - 1]));
  return ys[i - 1] + f * (ys[i] - ys[i - 1]);
}

function impulse(r: SimulationResult): number {
  const t = r.channels.time;
  const f = r.channels.force;
  let total = 0;
  for (let i = 1; i < t.length; i++) total += 0.5 * (f[i] + f[i - 1]) * (t[i] - t[i - 1]);
  return total;
}

const relErr = (actual: number, expected: number) => Math.abs(actual - expected) / Math.abs(expected);

describe.each(Object.keys(cases))('transient model matches sugar-ballistics: %s', (name) => {
  const ref = cases[name];
  let result: SimulationResult;

  it(
    'runs',
    async () => {
      result = await run(ref);
      expect(result.success).toBe(true);
      expect(result.alerts.filter((a) => a.level === 'ERROR')).toEqual([]);
    },
    60000,
  );

  it('matches propellant mass, peak pressure, impulse and burn time', () => {
    expect(relErr(result.getPropellantMass(), ref.mProp0)).toBeLessThan(2e-3);
    expect(relErr(Math.max(...result.channels.pressure), ref.pMax)).toBeLessThan(5e-3);
    expect(relErr(impulse(result), ref.impulse)).toBeLessThan(5e-3);
    expect(Math.abs(result.getBurnTime() - ref.burnTime)).toBeLessThan(0.02);
  });

  it('matches the pressure and thrust curves within 1% of their peaks', () => {
    const t = result.channels.time;
    const pPeak = Math.max(...ref.p);
    const fPeak = Math.max(...ref.f);
    let pWorst = 0;
    let fWorst = 0;
    ref.t.forEach((tr, i) => {
      pWorst = Math.max(pWorst, Math.abs(interp(t, result.channels.pressure, tr) - ref.p[i]) / pPeak);
      fWorst = Math.max(fWorst, Math.abs(interp(t, result.channels.force, tr) - ref.f[i]) / fPeak);
    });
    expect(pWorst).toBeLessThan(0.01);
    expect(fWorst).toBeLessThan(0.01);
  });

  // Within 1% for every grain, and the same imbalance as the original: FMM grains (Moon Burner, -1.3%)
  // lose a little because their area and volume tables don't satisfy dV/dx = A exactly.
  it('conserves mass as the original does: the nozzle expels what burnt', () => {
    const t = result.channels.time;
    const md = result.transient!.channels.nozzleMassFlow;
    let expelled = 0;
    for (let i = 1; i < t.length; i++) expelled += 0.5 * (md[i] + md[i - 1]) * (t[i] - t[i - 1]);
    const balance = expelled / ref.mProp0 - 1;
    expect(Math.abs(balance - ref.massBalance)).toBeLessThan(1e-3);
    if (name !== 'moon_validated') expect(Math.abs(balance)).toBeLessThan(0.01);
  });
});

describe('transient model with every effect off', () => {
  it('reproduces openMotor once the chamber has filled, and carries it as the baseline', async () => {
    const result = await run(cases.simple_openmotor, true);
    const baseline = result.transient!.baseline!;
    expect(baseline.channels.pressure).toEqual(new Motor(refSimple.motorDict as unknown as MotorDesign).runSimulation().channels.pressure);
    expect(relErr(Math.max(...result.channels.pressure), baseline.getMaxPressure())).toBeLessThan(0.02);
    expect(relErr(impulse(result), baseline.getImpulse())).toBeLessThan(0.01);
  }, 30000);
});

describe('transient model guards', () => {
  it('refuses a grain that leaves no free volume (end burner without extra volume)', async () => {
    const ref = cases.endburner_validated;
    const settings = settingsOf(ref);
    const design = refEndBurner.motorDict as unknown as MotorDesign;
    const result = await runTransientChunked(design, { ...settings, options: { ...settings.options, freeVolumeExtra: 0 } }, () => {}, () => false);
    expect(result!.success).toBe(false);
    expect(result!.alerts.some((a) => a.level === 'ERROR' && a.location === 'Transient')).toBe(true);
  });

  it('cancels cleanly', async () => {
    const design = refSimple.motorDict as unknown as MotorDesign;
    const result = await runTransientChunked(design, settingsOf(cases.simple_validated), () => {}, () => true);
    expect(result).toBeNull();
  });
});
