/**
 * Nozzle geometry and isentropic flow relations. Ported from motorlib/nozzle.py.
 */
import * as geometry from './geometry';
import { findFirstRisingRoot } from './numerics';
import { SimAlertLevel, SimAlertType, type NozzleConfig, type SimAlert } from './types';

/** Returns the expansion ratio of a nozzle given the pressure ratio it causes. */
export function eRatioFromPRatio(k: number, pRatio: number): number {
  return (
    ((k + 1) / 2) ** (1 / (k - 1)) *
    pRatio ** (1 / k) *
    (((k + 1) / (k - 1)) * (1 - pRatio ** ((k - 1) / k))) ** 0.5
  );
}

export function calcExpansion(nozzle: NozzleConfig): number {
  return (nozzle.exit / nozzle.throat) ** 2;
}

export function getThroatArea(nozzle: NozzleConfig, dThroat = 0): number {
  return geometry.circleArea(nozzle.throat + dThroat);
}

export function getExitArea(nozzle: NozzleConfig): number {
  return geometry.circleArea(nozzle.exit);
}

/** Solves for the nozzle's exit pressure given an input (chamber) pressure and specific heat ratio. */
export function getExitPressure(nozzle: NozzleConfig, k: number, inputPressure: number): number {
  if (inputPressure === 0) return 0;
  const expansion = calcExpansion(nozzle);
  if (!Number.isFinite(expansion) || expansion === 0) return 0;
  const target = 1 / expansion;
  const pRatio = findFirstRisingRoot((r) => eRatioFromPRatio(k, r), target, 1e-9, 1, 2000);
  return pRatio * inputPressure;
}

export function getDivergenceLosses(nozzle: NozzleConfig): number {
  const divAngleRad = (nozzle.divAngle * Math.PI) / 180;
  return (1 + Math.cos(divAngleRad)) / 2;
}

export function getThroatLosses(nozzle: NozzleConfig, dThroat = 0): number {
  const throatAspect = nozzle.throatLength / (nozzle.throat + dThroat);
  if (throatAspect > 0.45) return 0.95;
  return 0.99 - 0.0333 * throatAspect;
}

export function getSkinLosses(): number {
  return 0.99;
}

export function getIdealThrustCoeff(
  nozzle: NozzleConfig,
  chamberPres: number,
  ambPres: number,
  gamma: number,
  dThroat: number,
  exitPresIn?: number,
): number {
  if (chamberPres === 0) return 0;
  const exitPres = exitPresIn ?? getExitPressure(nozzle, gamma, chamberPres);
  const exitArea = getExitArea(nozzle);
  const throatArea = getThroatArea(nozzle, dThroat);

  const term1 = (2 * gamma ** 2) / (gamma - 1);
  const term2 = (2 / (gamma + 1)) ** ((gamma + 1) / (gamma - 1));
  const term3 = 1 - (exitPres / chamberPres) ** ((gamma - 1) / gamma);

  const momentumThrust = Math.sqrt(term1 * term2 * term3);
  const pressureThrust = ((exitPres - ambPres) * exitArea) / (throatArea * chamberPres);

  return momentumThrust + pressureThrust;
}

export function getAdjustedThrustCoeff(
  nozzle: NozzleConfig,
  chamberPres: number,
  ambPres: number,
  gamma: number,
  dThroat: number,
  exitPres?: number,
): number {
  const thrustCoeffIdeal = getIdealThrustCoeff(nozzle, chamberPres, ambPres, gamma, dThroat, exitPres);
  const divLoss = getDivergenceLosses(nozzle);
  const throatLoss = getThroatLosses(nozzle, dThroat);
  const skinLoss = getSkinLosses();
  return divLoss * throatLoss * nozzle.efficiency * (skinLoss * thrustCoeffIdeal + (1 - skinLoss));
}

export function getGeometryErrors(nozzle: NozzleConfig): SimAlert[] {
  const errors: SimAlert[] = [];
  if (nozzle.throat === 0) {
    errors.push({
      level: SimAlertLevel.ERROR,
      type: SimAlertType.GEOMETRY,
      description: 'Throat diameter must not be 0',
      location: 'Nozzle',
    });
  }
  if (nozzle.exit < nozzle.throat) {
    errors.push({
      level: SimAlertLevel.ERROR,
      type: SimAlertType.GEOMETRY,
      description: 'Exit diameter must not be smaller than throat diameter',
      location: 'Nozzle',
    });
  }
  if (nozzle.efficiency === 0) {
    errors.push({
      level: SimAlertLevel.ERROR,
      type: SimAlertType.CONSTRAINT,
      description: 'Efficiency must not be 0',
      location: 'Nozzle',
    });
  }
  return errors;
}
