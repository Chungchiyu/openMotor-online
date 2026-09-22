/**
 * Physical constants needed for motor calculations.
 * Ported from motorlib/constants.py — values and units are unchanged.
 */

/** R, in units of J/(kmol*K) */
export const gasConstant = 8314.462618;

/** Standard gravitational acceleration (g), in units of m/s^2 */
export const standardGravity = 9.80665;

/** Atmospheric pressure (1 atm), in units of Pa */
export const atmosphericPressure = 101325;

/** Maximum reference length for capping user inputs, in units of meters */
export const maximumRefLength = 24.6;

/** Maximum reference diameter for capping user inputs, in units of meters */
export const maximumRefDiameter = 6.6;
