/**
 * Confirms the chunked/cancellable simulation path (added for the progress dialog) produces
 * bit-identical results to the synchronous path — they share prepareSimulation/stepOnce/
 * finalizeSimulation (see motor.ts), so this locks in that refactor didn't let the two drift.
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import type { MotorDesign } from '../types';
import refSimple from '../__fixtures__/ref_simple.json';
import refStar from '../__fixtures__/ref_star.json';

async function runChunked(design: MotorDesign) {
  const motor = new Motor(design);
  const result = await motor.runSimulationChunked(
    () => {},
    () => false,
    50,
  );
  if (!result) throw new Error('unexpectedly cancelled');
  return result;
}

describe('runSimulationChunked matches runSimulation exactly', () => {
  it('BATES (simple fixture)', async () => {
    const design = refSimple.motorDict as unknown as MotorDesign;
    const sync = new Motor(design).runSimulation();
    const chunked = await runChunked(design);
    expect(chunked.channels.time).toEqual(sync.channels.time);
    expect(chunked.channels.pressure).toEqual(sync.channels.pressure);
    expect(chunked.channels.force).toEqual(sync.channels.force);
    expect(chunked.getBurnTime()).toBe(sync.getBurnTime());
    expect(chunked.getISP()).toBe(sync.getISP());
    expect(chunked.alerts).toEqual(sync.alerts);
  });

  it(
    'Star Grain (FMM fixture)',
    async () => {
      const design = refStar.motorDict as unknown as MotorDesign;
      const sync = new Motor(design).runSimulation();
      const chunked = await runChunked(design);
      expect(chunked.channels.pressure).toEqual(sync.channels.pressure);
      expect(chunked.getBurnTime()).toBe(sync.getBurnTime());
    },
    20000,
  );

  it('cancels cleanly when isCancelled becomes true', async () => {
    const design = refSimple.motorDict as unknown as MotorDesign;
    const motor = new Motor(design);
    let calls = 0;
    const result = await motor.runSimulationChunked(
      () => {},
      () => ++calls >= 1, // cancel on the first check
      5,
    );
    expect(result).toBeNull();
  });

  it('cancelling immediately skips the (potentially seconds-long) FMM grain setup entirely', async () => {
    // Regression test for the progress-dialog bug: `prepareSimulation` used to run every grain's
    // `simulationSetup()` synchronously before the very first `isCancelled()` check, so clicking
    // Cancel while an expensive Star/Moon Burner setup was in flight did nothing until it finished
    // on its own. `runSimulationChunked` now checks `isCancelled` before touching any grain, so a
    // cancel that arrives immediately should return near-instantly regardless of grain type.
    const design = refStar.motorDict as unknown as MotorDesign;
    const motor = new Motor(design);
    const start = Date.now();
    const result = await motor.runSimulationChunked(
      () => {},
      () => true, // already cancelled before the first check
    );
    const elapsedMs = Date.now() - start;
    expect(result).toBeNull();
    expect(elapsedMs).toBeLessThan(500); // the full Star Grain setup+run takes seconds, not ms
  });
});
