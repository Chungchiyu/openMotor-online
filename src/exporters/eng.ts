/**
 * RASP .eng motor file export. Ported from uilib/converters/engExporter.py's `doConversion` —
 * a widely-used plain-text format (RASP/"engine file") most rocketry simulators (OpenRocket,
 * RockSim, etc.) can read.
 */
import type { SimulationResult } from '../physics/simResult';

export interface EngSettings {
  designation: string;
  /** Motor case diameter, m */
  diameter: number;
  /** Motor case length, m */
  length: number;
  /** Non-propellant mass, kg */
  hardwareMass: number;
  manufacturer: string;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function buildEngFile(result: SimulationResult, settings: EngSettings): string {
  const propMass = result.getPropellantMass();
  const header =
    [
      settings.designation,
      String(round(settings.diameter * 1000, 6)),
      String(round(settings.length * 1000, 6)),
      'P',
      String(round(propMass, 6)),
      String(round(propMass + settings.hardwareMass, 6)),
      settings.manufacturer,
    ].join(' ') + '\n';

  const timeData = [...result.channels.time];
  const forceData = [...result.channels.force];
  // Add a 0-thrust datapoint right after the burn to satisfy RAS Aero, matching the Python original.
  if (forceData[forceData.length - 1] !== 0) {
    timeData.push(result.getBurnTime() + 0.01);
    forceData.push(0);
  }

  let body = '';
  for (let i = 0; i < timeData.length; i++) {
    const time = timeData[i];
    let force = forceData[i];
    if (time === 0) force += 0.01; // so the first point isn't 0 thrust
    body += `${round(time, 4)} ${round(force, 4)}\n`;
  }

  return header + body + ';\n;\n';
}
