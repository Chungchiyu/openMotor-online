/**
 * BurnSim 3.0 (.bsx) export/import. Ported from uilib/converters/burnsimExporter.py and
 * burnsimImporter.py — an XML format. Only the grain types BurnSim itself (and so openMotor's own
 * exporter) support round-trip: BATES and Moon Burner. Star Grain has no BurnSim equivalent in the
 * original either (its own EXPORT_TYPES table has no entry for it, and BurnSim's own "Star" grain
 * type is in the Python importer's UNSUPPORTED_GRAINS list) — so this isn't a gap specific to this
 * port.
 */
import { convert } from '../physics/units';
import type {
  BatesGrainProperties,
  GrainConfig,
  MoonBurnerProperties,
  MotorDesign,
  PropellantConfig,
} from '../physics/types';
import { getCombustionProperties, getCStar } from '../physics/propellant';
import { standardGravity } from '../physics/constants';

function mToIn(value: number): string {
  return String(convert(value, 'm', 'in'));
}

function inToM(value: string): number {
  return convert(Number.parseFloat(value), 'in', 'm');
}

export interface BurnSimExportResult {
  xml: string;
  /** Grains that couldn't be exported (e.g. Star Grain), by 1-based index — surfaced so the caller
   * can warn, matching the Python original telling the user which grains it skipped. */
  skipped: { index: number; type: string }[];
}

export function buildBurnSimFile(design: MotorDesign): BurnSimExportResult {
  const doc = document.implementation.createDocument(null, 'Motor');
  const motorEl = doc.documentElement;
  motorEl.setAttribute('Name', '');
  motorEl.setAttribute('DiameterMM', '0');
  motorEl.setAttribute('Length', '0');
  motorEl.setAttribute('Delays', '0');
  motorEl.setAttribute('HardwareWeight', '0');
  motorEl.setAttribute('MFGCode', '');
  motorEl.setAttribute('ThrustMethod', '1');
  motorEl.setAttribute('ThrustCoefGiven', '1.2');
  motorEl.setAttribute('UnitsLinear', '1');

  const nozzleEl = doc.createElement('Nozzle');
  nozzleEl.setAttribute('ThroatDia', mToIn(design.nozzle.throat));
  nozzleEl.setAttribute('ExitDia', mToIn(design.nozzle.exit));
  nozzleEl.setAttribute('NozzleEfficiency', String(Math.trunc(design.nozzle.efficiency * 100)));
  nozzleEl.setAttribute('AmbientPressure', '14.7');
  motorEl.appendChild(nozzleEl);

  const skipped: { index: number; type: string }[] = [];
  const propellant = design.propellant;

  design.grains.forEach((grain, gid) => {
    if ((grain.type !== 'BATES' && grain.type !== 'Moon Burner') || !propellant) {
      skipped.push({ index: gid + 1, type: grain.type });
      return;
    }

    const grainEl = doc.createElement('Grain');
    grainEl.setAttribute('Type', grain.type === 'BATES' ? '1' : '3');
    grainEl.setAttribute('Propellant', propellant.name);
    grainEl.setAttribute('Diameter', mToIn(grain.properties.diameter));
    grainEl.setAttribute('Length', mToIn(grain.properties.length));

    const ends = grain.properties.inhibitedEnds;
    grainEl.setAttribute('EndsInhibited', ends === 'Neither' ? '0' : ends === 'Top' || ends === 'Bottom' ? '1' : '2');

    if (grain.type === 'BATES') {
      const props: BatesGrainProperties = grain.properties;
      grainEl.setAttribute('CoreDiameter', mToIn(props.coreDiameter));
    } else {
      const props: MoonBurnerProperties = grain.properties;
      grainEl.setAttribute('CoreDiameter', mToIn(props.coreDiameter));
      grainEl.setAttribute('CoreOffset', mToIn(props.coreOffset));
    }

    const propEl = buildPropellantElement(doc, propellant);
    grainEl.appendChild(propEl);
    motorEl.appendChild(grainEl);
  });

  motorEl.appendChild(doc.createElement('MotorNotes'));

  const xml = new XMLSerializer().serializeToString(doc);
  return { xml, skipped };
}

function buildPropellantElement(doc: Document, propellant: PropellantConfig): Element {
  const propEl = doc.createElement('Propellant');
  propEl.setAttribute('Name', propellant.name);
  const exportPressure = 5.17e6;
  const { a: ballAraw, n: ballN, k: gamma, m } = getCombustionProperties(propellant, exportPressure);
  const ballA = convert(ballAraw * 6895 ** ballN, 'm/(s*Pa^n)', 'in/(s*psi^n)');
  propEl.setAttribute('BallisticA', String(ballA));
  propEl.setAttribute('BallisticN', String(ballN));
  propEl.setAttribute('Density', String(convert(propellant.density, 'kg/m^3', 'lb/in^3')));
  propEl.setAttribute('SpecificHeatRatio', String(gamma));
  propEl.setAttribute('MolarMass', String(m));
  propEl.setAttribute('CombustionTemp', '0');
  propEl.setAttribute('ISPStar', String(getCStar(propellant, exportPressure) / standardGravity));
  propEl.appendChild(doc.createElement('Notes'));
  return propEl;
}

const SUPPORTED_IMPORT_TYPES: Record<string, GrainConfig['type']> = {
  '1': 'BATES',
  '3': 'Moon Burner',
};

const UNSUPPORTED_IMPORT_LABELS: Record<string, string> = {
  '2': 'D Grain',
  '4': 'Star',
  '5': 'C Grain',
  '6': 'X Core',
  '7': 'Finocyl',
  '8': 'Tablet',
  '9': 'Pie Segment',
};

export interface BurnSimImportResult {
  design: MotorDesign;
  errors: string[];
}

function importPropellant(propEl: Element): { propellant: PropellantConfig; error: string | null } {
  const attr = (name: string) => propEl.getAttribute(name) ?? '0';
  const ballN = Number.parseFloat(attr('BallisticN'));
  let ballA = Number.parseFloat(attr('BallisticA')) * (1 / 6895 ** ballN);
  ballA = convert(ballA, 'in/(s*psi^n)', 'm/(s*Pa^n)');
  const density = convert(Number.parseFloat(attr('Density')), 'lb/in^3', 'kg/m^3');
  const gamma = Number.parseFloat(attr('SpecificHeatRatio'));
  const impMolarMass = attr('MolarMass');
  let error: string | null = null;
  let molarMass: number;
  if (impMolarMass === '0') {
    molarMass = 23.67;
    error = "Propellant didn't specify molar mass, using default.";
  } else {
    molarMass = Number.parseFloat(impMolarMass);
  }
  // BurnSim doesn't provide temperature — back it out from what it does provide, same as Python.
  const gasConstant = 8314.462618;
  const cstar = Number.parseFloat(attr('ISPStar')) * standardGravity;
  const temperature = ((cstar ** 2 * gamma * (2 / (gamma + 1)) ** ((gamma + 1) / (gamma - 1))) / gasConstant) * molarMass;

  return {
    propellant: {
      name: propEl.getAttribute('Name') ?? 'Imported',
      density,
      tabs: [{ minPressure: 0, maxPressure: 6.895e6, a: ballA, n: ballN, k: gamma, t: temperature, m: molarMass }],
    },
    error,
  };
}

export function parseBurnSimFile(xmlText: string, defaultConfig: MotorDesign['config'], defaultNozzle: MotorDesign['nozzle']): BurnSimImportResult {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) throw new Error('Could not parse this file as BurnSim XML.');

  const root = doc.documentElement;
  const errors: string[] = [];
  let propellant: PropellantConfig | null = null;
  const grains: GrainConfig[] = [];
  let nozzle = defaultNozzle;

  if (!root.querySelector('Grain')) {
    errors.push('Motor contains no grains, but the propellant and nozzle can still be imported.');
  }

  for (const child of Array.from(root.children)) {
    if (child.tagName === 'Nozzle') {
      nozzle = {
        ...defaultNozzle,
        throat: inToM(child.getAttribute('ThroatDia') ?? '0'),
        exit: inToM(child.getAttribute('ExitDia') ?? '0'),
        efficiency: Number.parseFloat(child.getAttribute('NozzleEfficiency') ?? '100') / 100,
        divAngle: 15,
        convAngle: 45,
      };
      errors.push('Nozzle angles not specified, assumed to be 15° and 45°.');
    }

    if (child.tagName === 'Grain') {
      const typeCode = child.getAttribute('Type') ?? '';
      const grainType = SUPPORTED_IMPORT_TYPES[typeCode];
      if (grainType === 'BATES') {
        const inhib = child.getAttribute('EndsInhibited');
        grains.push({
          type: 'BATES',
          properties: {
            diameter: inToM(child.getAttribute('Diameter') ?? '0'),
            length: inToM(child.getAttribute('Length') ?? '0'),
            coreDiameter: inToM(child.getAttribute('CoreDiameter') ?? '0'),
            inhibitedEnds: inhib === '1' ? 'Top' : inhib === '2' ? 'Both' : 'Neither',
          },
        });
      } else if (grainType === 'Moon Burner') {
        const inhib = child.getAttribute('EndsInhibited');
        grains.push({
          type: 'Moon Burner',
          properties: {
            diameter: inToM(child.getAttribute('Diameter') ?? '0'),
            length: inToM(child.getAttribute('Length') ?? '0'),
            coreDiameter: inToM(child.getAttribute('CoreDiameter') ?? '0'),
            coreOffset: inToM(child.getAttribute('CoreOffset') ?? '0'),
            inhibitedEnds: inhib === '1' ? 'Top' : inhib === '2' ? 'Both' : 'Neither',
          },
        });
      } else if (typeCode in UNSUPPORTED_IMPORT_LABELS) {
        errors.push(`File contains a ${UNSUPPORTED_IMPORT_LABELS[typeCode]} grain, which can't be imported.`);
      } else {
        errors.push(`File contains an unknown grain of type ${typeCode}.`);
      }

      if (!propellant) {
        const propEl = child.querySelector('Propellant');
        if (propEl) {
          const imported = importPropellant(propEl);
          propellant = imported.propellant;
          if (imported.error) errors.push(imported.error);
        }
      }
    }

    if (child.tagName === 'TestData') {
      errors.push('File contains test data, which is not imported.');
    }

    if (child.tagName === 'Propellant' && !propellant) {
      const imported = importPropellant(child);
      propellant = imported.propellant;
      if (imported.error) errors.push(imported.error);
    }
  }

  return { design: { grains, propellant, nozzle, config: defaultConfig }, errors };
}
