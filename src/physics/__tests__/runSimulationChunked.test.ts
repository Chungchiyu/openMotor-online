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

  it(
    'reports real, increasing progress *during* a Star Grain\'s setup, not just before/after it',
    async () => {
      // The chunked setup path (FmmGrain.simulationSetupChunked) is what actually fixes the
      // progress dialog sitting frozen for the whole multi-second table build — this locks in that
      // `onProgress` genuinely fires with distinct, increasing fractions while setup is still in
      // flight, not just once at the start and once after everything's already done.
      const design = refStar.motorDict as unknown as MotorDesign;
      const motor = new Motor(design);
      const setupFractions: number[] = [];
      let sawRunPhase = false;
      const result = await motor.runSimulationChunked((p) => {
        if (p.phase === 'setup') setupFractions.push(p.fraction);
        else sawRunPhase = true;
      }, () => false);

      expect(result?.success).toBe(true);
      expect(sawRunPhase).toBe(true);
      // More than just the guaranteed "0 before" and "1 after each grain" calls — i.e. real
      // progress reported from inside the perimeter-table loop, not a single jump from 0 to 1.
      expect(setupFractions.length).toBeGreaterThan(3);
      for (let i = 1; i < setupFractions.length; i++) {
        expect(setupFractions[i]).toBeGreaterThanOrEqual(setupFractions[i - 1]);
      }
      expect(setupFractions[0]).toBe(0);
      expect(setupFractions[setupFractions.length - 1]).toBe(1);
    },
    20000,
  );

  it(
    'cancelling partway through a Star Grain\'s setup stops promptly instead of running it to completion',
    async () => {
      const design = refStar.motorDict as unknown as MotorDesign;
      const motor = new Motor(design);
      let progressCalls = 0;
      const start = Date.now();
      const result = await motor.runSimulationChunked(
        () => {
          progressCalls++;
        },
        () => progressCalls >= 3, // cancel a few callbacks into the perimeter-table loop
      );
      const elapsedMs = Date.now() - start;
      expect(result).toBeNull();
      // Loose bound (not a tight one — wall-clock timing) that only needs to distinguish "stopped
      // partway" from "ran the whole multi-second setup and ignored the cancellation".
      expect(elapsedMs).toBeLessThan(5000);
    },
    20000,
  );
});
