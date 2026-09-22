/**
 * Propellant combustion property lookups. Ported from motorlib/propellant.py.
 */
import { gasConstant } from './constants';
import { findFirstRisingRoot } from './numerics';
import { SimAlertLevel, SimAlertType, type PropellantConfig, type PropellantTab, type SimAlert } from './types';

export function getCombustionProperties(prop: PropellantConfig, pressure: number): PropellantTab {
  let closest: PropellantTab | null = null;
  let closestPressure = 1e100;
  for (const tab of prop.tabs) {
    if (tab.minPressure < pressure && pressure < tab.maxPressure) {
      return tab;
    }
    if (Math.abs(pressure - tab.minPressure) < closestPressure) {
      closest = tab;
      closestPressure = Math.abs(pressure - tab.minPressure);
    }
    if (Math.abs(pressure - tab.maxPressure) < closestPressure) {
      closest = tab;
      closestPressure = Math.abs(pressure - tab.maxPressure);
    }
  }
  if (closest === null) throw new Error('Propellant has no combustion property tabs');
  return closest;
}

export function getCStar(prop: PropellantConfig, pressure: number): number {
  const { k: gamma, t: temp, m: molarMass } = getCombustionProperties(prop, pressure);
  const num = ((gamma * gasConstant) / molarMass) * temp;
  const denom = gamma * ((2 / (gamma + 1)) ** ((gamma + 1) / (gamma - 1))) ** 0.5;
  return num ** 0.5 / denom;
}

export function getBurnRate(prop: PropellantConfig, pressure: number): number {
  const { a, n } = getCombustionProperties(prop, pressure);
  return a * pressure ** n;
}

function getMinimumValidPressure(prop: PropellantConfig): number {
  return Math.min(...prop.tabs.map((t) => t.minPressure));
}

function getMaximumValidPressure(prop: PropellantConfig): number {
  return Math.max(...prop.tabs.map((t) => t.maxPressure));
}

export function getPressureFromKn(prop: PropellantConfig, kn: number): number {
  const density = prop.density;
  const minValid = getMinimumValidPressure(prop);
  const maxValid = getMaximumValidPressure(prop);
  const candidates: [number, number][] = []; // [error, pressure]

  for (const tab of prop.tabs) {
    const { a: ballA, n: ballN, k: gamma, t: temp, m: molarMass } = tab;
    const num = kn * density * ballA;
    const exponent = 1 / (1 - ballN);
    const denom = Math.sqrt(
      (gamma / ((gasConstant / molarMass) * temp)) * (2 / (gamma + 1)) ** ((gamma + 1) / (gamma - 1)),
    );
    const tabPressure = (num / denom) ** exponent;

    if (tab.minPressure === minValid && tabPressure < tab.maxPressure) return tabPressure;
    if (tab.maxPressure === maxValid && tab.minPressure < tabPressure) return tabPressure;
    if (tab.minPressure < tabPressure && tabPressure < tab.maxPressure) return tabPressure;
    candidates.push([Math.min(Math.abs(tab.minPressure - tabPressure), Math.abs(tabPressure - tab.maxPressure)), tabPressure]);
  }

  candidates.sort((a, b) => a[0] - b[0]);
  return candidates[0][1];
}

export function getKnFromPressure(prop: PropellantConfig, pressure: number): number {
  return findFirstRisingRoot((kn) => getPressureFromKn(prop, kn), pressure, 0, 1e6, 2000);
}

export function getErrors(prop: PropellantConfig): SimAlert[] {
  const errors: SimAlert[] = [];
  prop.tabs.forEach((tab, tabId) => {
    if (tab.maxPressure === tab.minPressure) {
      errors.push({
        level: SimAlertLevel.ERROR,
        type: SimAlertType.VALUE,
        description: `Tab #${tabId + 1} has the same minimum and maximum pressures.`,
        location: 'Propellant',
      });
    }
    if (tab.maxPressure < tab.minPressure) {
      errors.push({
        level: SimAlertLevel.ERROR,
        type: SimAlertType.VALUE,
        description: `Tab #${tabId + 1} has reversed pressure limits.`,
        location: 'Propellant',
      });
    }
    prop.tabs.forEach((otherTab, otherTabId) => {
      if (tabId !== otherTabId && otherTab.minPressure < tab.maxPressure && tab.maxPressure < otherTab.maxPressure) {
        errors.push({
          level: SimAlertLevel.ERROR,
          type: SimAlertType.VALUE,
          description: `Tabs #${tabId + 1} and #${otherTabId + 1} have overlapping ranges.`,
          location: 'Propellant',
        });
      }
    });
  });
  return errors;
}

export function getPressureErrors(prop: PropellantConfig, pressure: number): SimAlert[] {
  for (const tab of prop.tabs) {
    if (tab.minPressure < pressure && pressure < tab.maxPressure) return [];
  }
  return [
    {
      level: SimAlertLevel.WARNING,
      type: SimAlertType.VALUE,
      description: "Chamber pressure deviated from propellant's entered ranges. Results may not be accurate.",
      location: 'Propellant',
    },
  ];
}
