/**
 * The "Tools" menu: reverse-solves and design helpers ported from uilib/tools/*.py. Each tool is a
 * pure function from (design[, simResult]) + its own inputs to a new design, so the UI layer only
 * has to know how to collect inputs and call `apply` — no PyQt-style dialog/signal machinery to
 * reproduce, since everything here is synchronous.
 */
import { circleArea, circleDiameterFromArea } from './geometry';
import { Motor } from './motor';
import { getCombustionProperties, getKnFromPressure } from './propellant';
import type { SimulationResult } from './simResult';
import { buildGrain } from './grains';
import type { MotorDesign } from './types';

export interface ToolInputDef {
  key: string;
  label: string;
  /** Canonical unit for unit-aware display (see UnitsContext), or undefined for a plain number. */
  unitKind?: string;
  unit?: string;
  default: number;
}

export interface ToolDef {
  category: 'Set' | 'Optimize' | 'Design' | 'Analyze';
  name: string;
  description: string;
  inputs: ToolInputDef[];
  /** If true, the UI runs a simulation on the current design first and passes the result in. */
  needsSimulation: boolean;
  apply: (design: MotorDesign, input: Record<string, number>, sim: SimulationResult | null) => MotorDesign;
}

function buildMotor(design: MotorDesign): Motor {
  return new Motor(design);
}

// --- Set > Motor Diameter ---------------------------------------------------------------------
const changeDiameterTool: ToolDef = {
  category: 'Set',
  name: 'Motor Diameter',
  description: 'Sets the diameter of every grain in the motor.',
  inputs: [{ key: 'diameter', label: 'Diameter', unitKind: 'm', default: 0.05 }],
  needsSimulation: false,
  apply: (design, input) => ({
    ...design,
    grains: design.grains.map((g) => ({ ...g, properties: { ...g.properties, diameter: input.diameter } }) as MotorDesign['grains'][number]),
  }),
};

// --- Set > Initial Kn --------------------------------------------------------------------------
const initialKnTool: ToolDef = {
  category: 'Set',
  name: 'Initial Kn',
  description: "Sets the nozzle throat to achieve a specific Kn at startup.",
  inputs: [{ key: 'Kn', label: 'Kn', default: 250 }],
  needsSimulation: false,
  apply: (design, input) => {
    const motor = buildMotor(design);
    motor.grains.forEach((g) => g.simulationSetup(design.config));
    const surfArea = motor.calcBurningSurfaceArea(motor.grains.map(() => 0));
    const throatArea = surfArea / input.Kn;
    return { ...design, nozzle: { ...design.nozzle, throat: circleDiameterFromArea(throatArea) } };
  },
};

// --- Set > Max Kn (needs a simulation) ----------------------------------------------------------
const maxKnTool: ToolDef = {
  category: 'Set',
  name: 'Max Kn',
  description: 'Sets the nozzle throat to keep Kn below a certain value during the burn.',
  inputs: [{ key: 'Kn', label: 'Kn', default: 250 }],
  needsSimulation: true,
  apply: (design, input, sim) => {
    if (!sim) return design;
    const surfArea = sim.getPeakKN() * circleArea(design.nozzle.throat);
    const throatArea = surfArea / input.Kn;
    return { ...design, nozzle: { ...design.nozzle, throat: circleDiameterFromArea(throatArea) } };
  },
};

// --- Set > Max Pressure (needs a simulation) ----------------------------------------------------
const maxPressureTool: ToolDef = {
  category: 'Set',
  name: 'Max Pressure',
  description: 'Sets the nozzle throat to keep chamber pressure below a certain value during the burn.',
  inputs: [{ key: 'pressure', label: 'Pressure', unitKind: 'Pa', default: 7e6 }],
  needsSimulation: true,
  apply: (design, input, sim) => {
    if (!sim || !design.propellant) return design;
    const kn = getKnFromPressure(design.propellant, input.pressure);
    const surfArea = sim.getPeakKN() * circleArea(design.nozzle.throat);
    const throatArea = surfArea / kn;
    return { ...design, nozzle: { ...design.nozzle, throat: circleDiameterFromArea(throatArea) } };
  },
};

// --- Optimize > Nozzle Expansion (needs a simulation) -------------------------------------------
const expansionTool: ToolDef = {
  category: 'Optimize',
  name: 'Nozzle Expansion',
  description: "Sets the nozzle exit diameter to optimize expansion for the configured ambient pressure.",
  inputs: [],
  needsSimulation: true,
  apply: (design, _input, sim) => {
    if (!sim || !design.propellant) return design;
    const { k } = getCombustionProperties(design.propellant, sim.getAveragePressure());
    const pRatio = design.config.ambPressure / sim.getAveragePressure();
    const aRatio =
      ((k + 1) / 2) ** (1 / (k - 1)) * pRatio ** (1 / k) * (((k + 1) / (k - 1)) * (1 - pRatio ** ((k - 1) / k))) ** 0.5;
    const exitArea = circleArea(design.nozzle.throat) / aRatio;
    return { ...design, nozzle: { ...design.nozzle, exit: circleDiameterFromArea(exitArea) } };
  },
};

// --- Design > Neutral BATES Geometry -------------------------------------------------------------
const neutralBatesTool: ToolDef = {
  category: 'Design',
  name: 'Neutral BATES Geometry',
  description:
    'Generates the geometry for a neutral-burning BATES motor of a specified diameter and length. ' +
    'Length is the total space the propellant fits into, including spacers.',
  inputs: [
    { key: 'diameter', label: 'Propellant diameter', unitKind: 'm', default: 0.05 },
    { key: 'length', label: 'Propellant length', unitKind: 'm', default: 0.3 },
    { key: 'grainSpace', label: 'Grain spacer length', unitKind: 'm', default: 0.005 },
    { key: 'Kn', label: 'Initial Kn', default: 250 },
  ],
  needsSimulation: false,
  apply: (design, input) => {
    const grainLength = input.diameter * 1.68 + input.grainSpace;
    const numGrains = Math.floor(input.length / grainLength);
    const grains: MotorDesign['grains'] = [];
    for (let i = 0; i < numGrains; i++) {
      grains.push({
        type: 'BATES',
        properties: {
          diameter: input.diameter,
          length: grainLength - input.grainSpace,
          coreDiameter: input.diameter * 0.35,
          inhibitedEnds: 'Neither',
        },
      });
    }
    const surfArea = grains.reduce((sum, g) => sum + buildGrain(g).getSurfaceAreaAtRegression(0), 0);
    const throatArea = surfArea / input.Kn;
    const throat = circleDiameterFromArea(throatArea);
    return {
      ...design,
      grains,
      nozzle: {
        ...design.nozzle,
        throat,
        // Close enough to optimal for 14.7 PSI ambient — matches the Python tool's own comment
        // that this should eventually be optimized rather than a fixed ratio.
        exit: circleDiameterFromArea(throatArea * 7),
        divAngle: 15,
        convAngle: 65,
        efficiency: 0.92,
      },
    };
  },
};

// --- Analyze > Nozzle Erosion/Slag Coefficient (needs a simulation, then iterates internally) ---
const nozzleCoeffTool: ToolDef = {
  category: 'Analyze',
  name: 'Nozzle Erosion/Slag Coefficient',
  description:
    'Back-calculates the throat erosion or slag buildup coefficient from a measured post-firing throat diameter. ' +
    'If the throat grew, sets the erosion coefficient (and clears slag); if it shrank, sets the slag coefficient (and clears erosion).',
  inputs: [
    { key: 'finalDiameter', label: 'Post-Fire Throat Diameter', unitKind: 'm', default: 0.01 },
    { key: 'convergenceThreshold', label: 'Convergence Threshold', unit: '%', default: 1 },
  ],
  needsSimulation: true,
  apply: (design, input, sim) => {
    if (!sim) return design;
    const initialDiameter = design.nozzle.throat;
    const dThroatTarget = input.finalDiameter - initialDiameter;
    const burnTime = sim.getBurnTime();
    const avgPressure = sim.getAveragePressure();

    if (burnTime === 0 || avgPressure === 0 || dThroatTarget === 0) {
      return { ...design, nozzle: { ...design.nozzle, erosionCoeff: 0, slagCoeff: 0 } };
    }

    const isErosion = dThroatTarget > 0;
    let coeff = isErosion ? dThroatTarget / (2 * avgPressure * burnTime) : (-dThroatTarget * avgPressure) / (2 * burnTime);
    const threshold = input.convergenceThreshold / 100;
    const maxIterations = 10;

    let lastDesign = design;
    for (let iter = 0; iter < maxIterations; iter++) {
      const iterNozzle = {
        ...design.nozzle,
        erosionCoeff: isErosion ? coeff : 0,
        slagCoeff: isErosion ? 0 : coeff,
      };
      lastDesign = { ...design, nozzle: iterNozzle };
      const iterSim = buildMotor(lastDesign).runSimulation();
      if (!iterSim.success) break;
      const actualDThroat = iterSim.channels.dThroat[iterSim.channels.dThroat.length - 1];
      if (actualDThroat === 0) break;
      const relError = Math.abs(actualDThroat - dThroatTarget) / Math.abs(dThroatTarget);
      if (relError <= threshold) return lastDesign;
      coeff *= dThroatTarget / actualDThroat;
    }
    return lastDesign;
  },
};

export const tools: ToolDef[] = [
  changeDiameterTool,
  initialKnTool,
  maxKnTool,
  maxPressureTool,
  expansionTool,
  neutralBatesTool,
  nozzleCoeffTool,
];

export const toolCategories: ToolDef['category'][] = ['Set', 'Optimize', 'Design', 'Analyze'];

export function toolsByCategory(category: ToolDef['category']): ToolDef[] {
  return tools.filter((t) => t.category === category);
}
