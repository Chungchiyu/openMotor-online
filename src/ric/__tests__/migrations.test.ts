/**
 * Fixtures below are real (motor_0_4_0_tiny) and synthetic (the other two) `.ric` files taken
 * verbatim from/for the Python openMotor engine. Expected values are ground truth captured by
 * running the real Python engine's `fileIO.loadFile` on these exact files (`uilib/fileIO.py`,
 * openMotor repo) — not transcribed from the migration source by hand. See migrations.ts's header
 * for why. Inlined as strings (rather than external fixture files) to match this project's existing
 * test convention and avoid needing Node's `fs`/`path` types in the browser-targeted tsconfig.
 */
import { describe, expect, it } from 'vitest';
import { importMotorRic } from '../index';

// Real fixture: test/data/regression/tiny/motor.ric from the openMotor repo.
const MOTOR_0_4_0_TINY = `
data:
  config: {ambPressure: 101324.99674500001, burnoutThrustThres: 0.1, burnoutWebThres: 0.00025400050800101603,
    igniterPressure: 1034250.0000000001, mapDim: 750, maxMassFlux: 1406.4697609001405,
    maxPressure: 10342500.000000002, minPortThroat: 2.0, timestep: 0.01}
  grains:
  - properties: {coreDiameter: 0.008255016510033021, diameter: 0.025400050800101603,
      inhibitedEnds: Neither, length: 0.04572009144018289}
    type: BATES
  nozzle: {convAngle: 65.0, divAngle: 15.0, efficiency: 0.8, exit: 0.007620015240030481,
    throat: 0.0030480060960121924, throatLength: 0.0010160020320040641}
  propellant:
    density: 1680.0037644662068
    name: MIT - Cherry Limeade
    tabs:
    - {a: 3.517054143255937e-05, k: 1.21, m: 23.67, maxPressure: 6895000.000000001,
      minPressure: 0.0, n: 0.3273, t: 3500.0}
type: !!python/object/apply:uilib.fileIO.fileTypes [3]
version: !!python/tuple [0, 4, 0]
`;

// Synthetic, hand-built and verified by running it through the real Python `fileIO.loadFile` —
// exercises the 0.3.0 -> 0.4.0 propellant tabularization and the Finocyl invertedFins backfill.
const MOTOR_0_3_0_SYNTHETIC = `
version: !!python/tuple [0, 3, 0]
type: !!python/object/apply:uilib.fileIO.fileTypes [3]
data:
  grains:
    - type: BATES
      properties: {diameter: 0.05, length: 0.1, coreDiameter: 0.02, inhibitedEnds: Neither}
    - type: Finocyl
      properties: {diameter: 0.05, length: 0.1, coreDiameter: 0.02, inhibitedEnds: Neither, numFins: 4, finWidth: 0.005, finLength: 0.01}
  propellant: {name: Test Prop, density: 1700, a: 1.0e-5, n: 0.3, k: 1.2, t: 1600, m: 25}
  nozzle: {throat: 0.01, exit: 0.03, efficiency: 0.9, divAngle: 15, convAngle: 55, throatLength: 0.0035}
  config: {maxPressure: 1000, maxMassFlux: 500, minPortThroat: 1.5, igniterPressure: 999, timestep: 0.02, ambPressure: 101325, burnoutThrustThres: 0.1, burnoutWebThres: 2.5e-5}
`;

// Synthetic, verified against the real Python engine — exercises the 0.2.0 -> 0.3.0 nozzle-angle
// addition (config is replaced wholesale by that migration's default-config fallback; see
// migrations.ts's header for the documented deviation there).
const MOTOR_0_2_0_SYNTHETIC = `
version: !!python/tuple [0, 2, 0]
type: !!python/object/apply:uilib.fileIO.fileTypes [3]
data:
  grains:
    - type: BATES
      properties: {diameter: 0.05, length: 0.1, coreDiameter: 0.02, inhibitedEnds: Neither}
  propellant: {name: Test Prop, density: 1700, a: 1.0e-5, n: 0.3, k: 1.2, t: 1600, m: 25}
  nozzle: {throat: 0.01, exit: 0.03, efficiency: 0.9}
`;

describe('MOTOR migration chain', () => {
  it('migrates a real 0.4.0 file (tiny/motor.ric) to current, matching Python ground truth', () => {
    const { design, errors } = importMotorRic(MOTOR_0_4_0_TINY);
    expect(errors).toEqual([]);
    expect(design).toEqual({
      grains: [
        {
          type: 'BATES',
          properties: {
            coreDiameter: 0.008255016510033021,
            diameter: 0.025400050800101603,
            inhibitedEnds: 'Neither',
            length: 0.04572009144018289,
          },
        },
      ],
      propellant: {
        density: 1680.0037644662068,
        name: 'MIT - Cherry Limeade',
        tabs: [
          {
            a: 3.517054143255937e-5,
            k: 1.21,
            m: 23.67,
            maxPressure: 6895000.000000001,
            minPressure: 0,
            n: 0.3273,
            t: 3500,
          },
        ],
      },
      nozzle: {
        convAngle: 65,
        divAngle: 15,
        efficiency: 0.8,
        exit: 0.007620015240030481,
        throat: 0.0030480060960121924,
        throatLength: 0.0010160020320040641,
      },
      config: {
        ambPressure: 101324.99674500001,
        burnoutThrustThres: 0.1,
        burnoutWebThres: 0.00025400050800101603,
        flowSeparationWarnPercent: 0.05,
        mapDim: 750,
        maxMachNumber: 0.7,
        maxMassFlux: 1406.4697609001405,
        maxPressure: 10342500.000000002,
        minPortThroat: 2,
        sepPressureRatio: 0.4,
        timestep: 0.01,
      },
    });
  });

  it('migrates a synthetic 0.3.0 file through propellant tabularization and the Finocyl invertedFins backfill', () => {
    const { design, errors } = importMotorRic(MOTOR_0_3_0_SYNTHETIC);
    expect(errors).toEqual([]);
    expect(design.propellant).toEqual({
      name: 'Test Prop',
      density: 1700,
      tabs: [{ a: 1e-5, n: 0.3, k: 1.2, t: 1600, m: 25, minPressure: 0, maxPressure: 10342000 }],
    });
    const finocyl = design.grains.find((g) => g.type === 'Finocyl');
    expect(finocyl?.properties).toMatchObject({ invertedFins: false });
    expect(design.config).toMatchObject({
      maxMachNumber: 0.7,
      sepPressureRatio: 0.4,
      flowSeparationWarnPercent: 0.05,
      maxPressure: 1000,
      maxMassFlux: 500,
      minPortThroat: 1.5,
    });
    expect(design.config).not.toHaveProperty('igniterPressure');
    expect(design.nozzle).toEqual({
      throat: 0.01,
      exit: 0.03,
      efficiency: 0.9,
      divAngle: 15,
      convAngle: 55,
      throatLength: 0.0035,
    });
  });

  it('migrates a synthetic 0.2.0 file through the nozzle-angle-addition step (with the documented default-config deviation)', () => {
    const { design, errors } = importMotorRic(MOTOR_0_2_0_SYNTHETIC);
    expect(errors).toEqual([]);
    expect(design.nozzle).toMatchObject({
      throat: 0.01,
      exit: 0.03,
      efficiency: 0.9,
      divAngle: 15,
      convAngle: 55,
      throatLength: 0.35 * 0.01,
    });
    // 0.3.0's propellant tabularization and every later hop still apply on top.
    expect(design.propellant?.tabs[0].maxPressure).toBe(10342000);
  });
});
