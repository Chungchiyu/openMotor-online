import { describe, expect, it } from 'vitest';
import { importMotorRic } from '../index';
import { writeRicFile, RicFileType } from '../envelope';

describe('Custom Grain import handling', () => {
  it('skips a Custom Grain with an error, but still imports the rest of the motor', () => {
    const data = {
      grains: [
        { type: 'BATES', properties: { diameter: 0.05, length: 0.1, coreDiameter: 0.02, inhibitedEnds: 'Neither' } },
        { type: 'Custom Grain', properties: { points: [[[0, 0], [1, 0], [1, 1]]], dxfUnit: 'mm' } },
      ],
      propellant: null,
      nozzle: { throat: 0, exit: 0, efficiency: 0.9, divAngle: 15, convAngle: 45, throatLength: 0, slagCoeff: 0, erosionCoeff: 0 },
      config: {
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
      },
    };
    const text = writeRicFile(RicFileType.MOTOR, data);
    const { design, errors } = importMotorRic(text);
    expect(design.grains).toHaveLength(1);
    expect(design.grains[0].type).toBe('BATES');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Custom Grain/);
  });
});
