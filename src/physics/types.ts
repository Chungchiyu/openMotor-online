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

export interface MoonBurnerProperties {
  diameter: number;
  length: number;
  coreDiameter: number;
  coreOffset: number;
  inhibitedEnds: InhibitedEnds;
}

export interface DGrainProperties {
  diameter: number;
  length: number;
  inhibitedEnds: InhibitedEnds;
  slotOffset: number;
}

export interface XCoreProperties {
  diameter: number;
  length: number;
  inhibitedEnds: InhibitedEnds;
  slotWidth: number;
  slotLength: number;
}

export interface CGrainProperties {
  diameter: number;
  length: number;
  inhibitedEnds: InhibitedEnds;
  slotWidth: number;
  slotOffset: number;
}

export interface EndBurnerProperties {
  diameter: number;
  length: number;
}

export interface ConicalGrainProperties {
  diameter: number;
  length: number;
  inhibitedEnds: InhibitedEnds;
  forwardCoreDiameter: number;
  aftCoreDiameter: number;
}

export interface RodTubeGrainProperties {
  diameter: number;
  length: number;
  inhibitedEnds: InhibitedEnds;
  coreDiameter: number;
  rodDiameter: number;
  supportDiameter: number;
}

export interface FinocylProperties {
  diameter: number;
  length: number;
  inhibitedEnds: InhibitedEnds;
  numFins: number;
  finWidth: number;
  finLength: number;
  coreDiameter: number;
  invertedFins: boolean;
}

export type GrainConfig =
  | { type: 'BATES'; properties: BatesGrainProperties }
  | { type: 'Star Grain'; properties: StarGrainProperties }
  | { type: 'Moon Burner'; properties: MoonBurnerProperties }
  | { type: 'D Grain'; properties: DGrainProperties }
  | { type: 'X Core'; properties: XCoreProperties }
  | { type: 'C Grain'; properties: CGrainProperties }
  | { type: 'Finocyl'; properties: FinocylProperties }
  | { type: 'Rod and Tube'; properties: RodTubeGrainProperties }
  | { type: 'End Burner'; properties: EndBurnerProperties }
  | { type: 'Conical'; properties: ConicalGrainProperties };

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

/**
 * Matches openMotor's own `DEFAULT_PREFERENCES['general']` (uilib/defaults.py) exactly, with one
 * deliberate exception: `mapDim` is 400 here, not 750. That only affects the fast-marching grid
 * resolution for FMM grains (Star, etc.) — BATES doesn't use it — and 750 was too slow for
 * interactive use in JS (see fmmGrain.ts). Every other value affects the physics or alert
 * thresholds directly and must not drift from the source; `burnoutWebThres` in particular being
 * off by 10x here previously caused real (non-truncation) divergence from Python at the tail end
 * of a burn — see defaultMotorConfig.reference.test.ts.
 */
export function defaultMotorConfig(): MotorConfigProperties {
  return {
    maxPressure: 10342500,
    maxMassFlux: 1406.4697609001405,
    maxMachNumber: 0.7,
    minPortThroat: 2,
    flowSeparationWarnPercent: 0.05,
    burnoutWebThres: 2.5400050800101604e-5,
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
