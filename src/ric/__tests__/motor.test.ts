import { describe, expect, it } from 'vitest';
import { importMotorRic, exportMotorRic } from '../index';
import { writeRicFile, RicFileType } from '../envelope';
import { defaultTransientSettings } from '../../physics/transient/options';
import type { MotorDesign } from '../../physics/types';

const config = {
  maxPressure: 0,
  maxMassFlux: 0,
  maxMachNumber: 0,
  minPortThroat: 0,
  flowSeparationWarnPercent: 0,
  burnoutWebThres: 0,
  burnoutThrustThres: 0,
  timestep: 0,
  ambPressure: 0,
  mapDim: 400,
  sepPressureRatio: 0,
};
const nozzle = { throat: 0, exit: 0, efficiency: 0.9, divAngle: 15, convAngle: 45, throatLength: 0, slagCoeff: 0, erosionCoeff: 0 };

describe('unknown grain type import handling', () => {
  it('skips a grain of an unrecognized type with an error, but still imports the rest of the motor', () => {
    const data = {
      grains: [
        { type: 'BATES', properties: { diameter: 0.05, length: 0.1, coreDiameter: 0.02, inhibitedEnds: 'Neither' } },
        { type: 'Some Future Grain', properties: {} },
      ],
      propellant: null,
      nozzle,
      config,
    };
    const text = writeRicFile(RicFileType.MOTOR, data);
    const { design, errors } = importMotorRic(text);
    expect(design.grains).toHaveLength(1);
    expect(design.grains[0].type).toBe('BATES');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/unknown type/);
  });
});

describe('Custom Grain import handling', () => {
  it('converts points from the stored dxfUnit into meters', () => {
    const data = {
      grains: [
        {
          type: 'Custom Grain',
          properties: {
            diameter: 0.05,
            length: 0.1,
            inhibitedEnds: 'Neither',
            dxfUnit: 'mm',
            points: [
              [
                [0, 0],
                [10, 0],
                [10, 10],
              ],
            ],
          },
        },
      ],
      propellant: null,
      nozzle,
      config,
    };
    const text = writeRicFile(RicFileType.MOTOR, data);
    const { design, errors } = importMotorRic(text);
    expect(errors).toHaveLength(0);
    expect(design.grains).toHaveLength(1);
    const grain = design.grains[0];
    if (grain.type !== 'Custom Grain') throw new Error('expected Custom Grain');
    expect(grain.properties.points).toEqual([
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
    ]);
  });

  it('keeps only the largest polygon when the file has more than one, with a warning', () => {
    const data = {
      grains: [
        {
          type: 'Custom Grain',
          properties: {
            diameter: 0.05,
            length: 0.1,
            inhibitedEnds: 'Neither',
            dxfUnit: 'm',
            points: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
              ],
              [
                [0, 0],
                [0.1, 0],
                [0.1, 0.1],
              ],
            ],
          },
        },
      ],
      propellant: null,
      nozzle,
      config,
    };
    const text = writeRicFile(RicFileType.MOTOR, data);
    const { design, errors } = importMotorRic(text);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/multi-core/);
    const grain = design.grains[0];
    if (grain.type !== 'Custom Grain') throw new Error('expected Custom Grain');
    expect(grain.properties.points).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });

  it('round-trips a Custom Grain through export then import unchanged (in meters)', () => {
    const design: MotorDesign = {
      grains: [
        {
          type: 'Custom Grain',
          properties: {
            diameter: 0.05,
            length: 0.1,
            inhibitedEnds: 'Neither',
            points: [
              [0, 0],
              [0.02, 0],
              [0.02, 0.02],
            ],
          },
        },
      ],
      propellant: null,
      nozzle,
      config,
    };
    const text = exportMotorRic(design);
    const { design: reimported, errors } = importMotorRic(text);
    expect(errors).toHaveLength(0);
    expect(reimported.grains).toEqual(design.grains);
  });
});

describe('transient model settings', () => {
  it('are left out of an exported .ric, which stays identical to the same design without them', () => {
    const design: MotorDesign = { grains: [], propellant: null, nozzle, config };
    const withTransient: MotorDesign = { ...design, transient: { ...defaultTransientSettings(), enabled: true } };
    const text = exportMotorRic(withTransient);
    expect(text).toBe(exportMotorRic(design));
    expect(text).not.toMatch(/transient/);
    expect(importMotorRic(text).design.transient).toBeUndefined();
  });
});
