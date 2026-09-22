/** Shared plain-data types for the physics engine. These are the serializable shapes that flow
 * between the UI, the simulation and JSON save files — deliberately plain objects/interfaces
 * rather than a port of motorlib's Property/PropertyCollection class hierarchy, which exists in
 * Python mainly to support Qt widget binding that has no equivalent here. */

export type InhibitedEnds = 'Neither' | 'Top' | 'Bottom' | 'Both';

export interface BatesGrainProperties {
  diameter: number;
  length: number;
  coreDiameter: number;
  inhibitedEnds: InhibitedEnds;
}

export interface StarGrainProperties {
  diameter: number;
  length: number;
  numPoints: number;
  pointLength: number;
  pointWidth: number;
  inhibitedEnds: InhibitedEnds;
}

export type GrainConfig =
  | { type: 'BATES'; properties: BatesGrainProperties }
  | { type: 'Star Grain'; properties: StarGrainProperties };

export interface PropellantTab {
  minPressure: number;
  maxPressure: number;
  /** Burn rate coefficient */
  a: number;
  /** Burn rate exponent */
  n: number;
  /** Specific heat ratio */
  k: number;
  /** Combustion temperature, K */
  t: number;
  /** Exhaust molar mass, g/mol */
  m: number;
}

export interface PropellantConfig {
  name: string;
  /** kg/m^3 */
  density: number;
  tabs: PropellantTab[];
}

export interface NozzleConfig {
  throat: number;
  exit: number;
  efficiency: number;
  divAngle: number;
  convAngle: number;
  throatLength: number;
  slagCoeff: number;
  erosionCoeff: number;
}

export interface MotorConfigProperties {
  maxPressure: number;
  maxMassFlux: number;
  maxMachNumber: number;
  minPortThroat: number;
  flowSeparationWarnPercent: number;
  burnoutWebThres: number;
  burnoutThrustThres: number;
  timestep: number;
  ambPressure: number;
  mapDim: number;
  sepPressureRatio: number;
}

export interface MotorDesign {
  grains: GrainConfig[];
  propellant: PropellantConfig | null;
  nozzle: NozzleConfig;
  config: MotorConfigProperties;
}

// Plain string-literal unions + const lookup objects rather than `enum` — the project's
// `erasableSyntaxOnly` TS setting disallows real enums since they aren't purely type-level.
export const SimAlertLevel = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  MESSAGE: 'MESSAGE',
} as const;
export type SimAlertLevel = (typeof SimAlertLevel)[keyof typeof SimAlertLevel];

export const SimAlertType = {
  GEOMETRY: 'GEOMETRY',
  CONSTRAINT: 'CONSTRAINT',
  VALUE: 'VALUE',
} as const;
export type SimAlertType = (typeof SimAlertType)[keyof typeof SimAlertType];

export interface SimAlert {
  level: SimAlertLevel;
  type: SimAlertType;
  description: string;
  location?: string;
}

export function defaultMotorConfig(): MotorConfigProperties {
  return {
    maxPressure: 7e6,
    maxMassFlux: 1406.96,
    maxMachNumber: 1,
    minPortThroat: 2,
    flowSeparationWarnPercent: 0.05,
    burnoutWebThres: 0.00025,
    burnoutThrustThres: 0.1,
    timestep: 0.03,
    ambPressure: 101325,
    mapDim: 400,
    sepPressureRatio: 0.4,
  };
}

export function defaultNozzle(): NozzleConfig {
  return {
    throat: 0,
    exit: 0,
    efficiency: 0.9,
    divAngle: 15,
    convAngle: 45,
    throatLength: 0,
    slagCoeff: 0,
    erosionCoeff: 0,
  };
}
