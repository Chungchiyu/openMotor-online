import { describe, expect, it } from 'vitest';
import { defaultMotorConfig, defaultNozzle, type MotorDesign } from '../../physics/types';
import { buildBurnSimFile, parseBurnSimFile } from '../burnsim';

function design(): MotorDesign {
  return {
    grains: [
      { type: 'BATES', properties: { diameter: 0.075, length: 0.15, coreDiameter: 0.025, inhibitedEnds: 'Neither' } },
      { type: 'Star Grain', properties: { diameter: 0.075, length: 0.15, numPoints: 6, pointLength: 0.02, pointWidth: 0.008, inhibitedEnds: 'Neither' } },
    ],
    propellant: {
      name: 'Nakka - KNSU',
      density: 1800,
      tabs: [{ minPressure: 0, maxPressure: 10342500, a: 0.00010073115141607291, n: 0.319, k: 1.133, t: 1720, m: 41.98 }],
    },
    nozzle: { throat: 0.01, exit: 0.025, efficiency: 0.9, divAngle: 15, convAngle: 45, throatLength: 0.005, slagCoeff: 0, erosionCoeff: 0 },
    config: defaultMotorConfig(),
  };
}

describe('BurnSim export/import', () => {
  it('exports BATES, skips Star Grain (no BurnSim equivalent, matching upstream)', () => {
    const { xml, skipped } = buildBurnSimFile(design());
    expect(xml).toContain('<Nozzle');
    expect(xml).toContain('Type="1"'); // BATES
    expect(skipped).toEqual([{ index: 2, type: 'Star Grain' }]);
  });

  it('round-trips the BATES grain and propellant through export -> import', () => {
    const original = design();
    const { xml } = buildBurnSimFile(original);
    const { design: imported, errors } = parseBurnSimFile(xml, defaultMotorConfig(), defaultNozzle());

    expect(imported.grains).toHaveLength(1); // Star Grain was skipped on export
    expect(imported.grains[0].type).toBe('BATES');
    if (imported.grains[0].type === 'BATES') {
      expect(imported.grains[0].properties.diameter).toBeCloseTo(0.075, 4);
      expect(imported.grains[0].properties.coreDiameter).toBeCloseTo(0.025, 4);
    }
    expect(imported.propellant?.name).toBe('Nakka - KNSU');
    expect(imported.propellant?.density).toBeCloseTo(1800, 0);
    expect(imported.nozzle.throat).toBeCloseTo(0.01, 4);
    expect(imported.nozzle.exit).toBeCloseTo(0.025, 4);
    expect(errors.some((e) => e.includes('angles'))).toBe(true);
  });

  it('rejects garbage input', () => {
    expect(() => parseBurnSimFile('not xml at all {{{', defaultMotorConfig(), defaultNozzle())).toThrow();
  });
});
