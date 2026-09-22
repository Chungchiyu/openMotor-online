/**
 * Reference tests for the Tools menu (uilib/tools/*.py), comparing against values computed by
 * running the equivalent Python logic directly against motorlib on the same design.
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import { tools } from '../tools';
import type { MotorDesign, PropellantConfig } from '../types';

const propellant: PropellantConfig = {
  name: 'Nakka - KNSU',
  density: 1800,
  tabs: [{ minPressure: 0, maxPressure: 10342500, a: 0.00010073115141607291, n: 0.319, k: 1.133, t: 1720, m: 41.98 }],
};

function baseDesign(): MotorDesign {
  return {
    grains: [{ type: 'BATES', properties: { diameter: 0.075, length: 0.15, coreDiameter: 0.025, inhibitedEnds: 'Neither' } }],
    propellant,
    nozzle: { throat: 0.01, exit: 0.025, efficiency: 0.9, divAngle: 15, convAngle: 45, throatLength: 0.005, slagCoeff: 0, erosionCoeff: 0 },
    config: {
      maxPressure: 1e7,
      maxMassFlux: 2000,
      maxMachNumber: 1,
      minPortThroat: 1,
      flowSeparationWarnPercent: 0.5,
      burnoutWebThres: 0.00025,
      burnoutThrustThres: 0.1,
      timestep: 0.03,
      ambPressure: 101325,
      mapDim: 400,
      sepPressureRatio: 0.1,
    },
  };
}

function find(name: string) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`tool not found: ${name}`);
  return tool;
}

describe('Tools match Python reference', () => {
  it('Initial Kn -> throat diameter', () => {
    const tool = find('Initial Kn');
    const result = tool.apply(baseDesign(), { Kn: 300 }, null);
    expect(result.nozzle.throat).toBeCloseTo(0.009128709291752768, 9);
  });

  it('Nozzle Expansion -> exit diameter', () => {
    const design = baseDesign();
    const sim = new Motor(design).runSimulation();
    const tool = find('Nozzle Expansion');
    const result = tool.apply(design, {}, sim);
    expect(result.nozzle.exit).toBeCloseTo(0.03348577123447526, 6);
  });

  it('Neutral BATES Geometry -> grain count, throat and exit', () => {
    const tool = find('Neutral BATES Geometry');
    const result = tool.apply(baseDesign(), { diameter: 0.05, length: 0.3, grainSpace: 0.005, Kn: 250 }, null);
    expect(result.grains).toHaveLength(3);
    expect(result.nozzle.throat).toBeCloseTo(0.0111, 4);
    expect(result.nozzle.exit).toBeCloseTo(0.02936783955281696, 6);
  });

  it('Motor Diameter -> sets every grain diameter', () => {
    const design = baseDesign();
    design.grains.push({ type: 'BATES', properties: { diameter: 0.05, length: 0.1, coreDiameter: 0.01, inhibitedEnds: 'Neither' } });
    const tool = find('Motor Diameter');
    const result = tool.apply(design, { diameter: 0.09 }, null);
    for (const g of result.grains) expect(g.properties.diameter).toBe(0.09);
  });

  it('Nozzle Erosion/Slag Coefficient converges to the Python reference coefficient', () => {
    const design = baseDesign();
    const sim = new Motor(design).runSimulation();
    const tool = find('Nozzle Erosion/Slag Coefficient');
    const result = tool.apply(design, { finalDiameter: 0.0105, convergenceThreshold: 1 }, sim);
    expect(result.nozzle.erosionCoeff).toBeCloseTo(2.1578669090442557e-11, 15);
    expect(result.nozzle.slagCoeff).toBe(0);
  });
});
