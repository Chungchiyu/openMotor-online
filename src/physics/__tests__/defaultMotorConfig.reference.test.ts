/**
 * Regression test for a real bug: `defaultMotorConfig()` had hand-approximated values instead of
 * openMotor's actual `DEFAULT_PREFERENCES['general']` (uilib/defaults.py). `burnoutWebThres` in
 * particular was 10x too large (0.00025 vs the real 2.54e-5), which changes when a grain is
 * considered burned out and so does affect physics results near the tail of a burn — not just
 * floating-point noise. A user leaving Config untouched (the common case) and comparing against
 * real openMotor would see a real, non-truncation divergence purely from this default mismatch.
 */
import { describe, expect, it } from 'vitest';
import { defaultMotorConfig } from '../types';

describe('defaultMotorConfig matches openMotor DEFAULT_PREFERENCES.general', () => {
  const config = defaultMotorConfig();

  it('burnoutWebThres (the value that actually changes physics results)', () => {
    expect(config.burnoutWebThres).toBeCloseTo(2.5400050800101604e-5, 12);
  });

  it('the other physics/alert-threshold values', () => {
    expect(config.maxPressure).toBe(10342500);
    expect(config.maxMassFlux).toBeCloseTo(1406.4697609001405, 6);
    expect(config.maxMachNumber).toBe(0.7);
    expect(config.minPortThroat).toBe(2);
    expect(config.flowSeparationWarnPercent).toBe(0.05);
    expect(config.burnoutThrustThres).toBe(0.1);
    expect(config.timestep).toBe(0.03);
    expect(config.ambPressure).toBe(101325);
    expect(config.sepPressureRatio).toBe(0.4);
  });

  it('mapDim is deliberately NOT 750 (the real default) — see the function comment', () => {
    expect(config.mapDim).toBe(400);
  });
});
