/**
 * Regression test for the "Area Graph" preview tab: it must plot burning PERIMETER (contour
 * length) vs. regression depth, matching what the original desktop app's grain preview widget
 * actually shows (`GrainPreviewWidget._genData` -> `grain.getRegressionData()`, which sums contour
 * lengths — never the simulation's own `faceArea` array). This used to compute actual remaining
 * face area instead, a fundamentally different (and for BATES, oppositely-trending) curve.
 */
import { describe, expect, it } from 'vitest';
import * as geometry from '../geometry';
import { BatesGrain } from '../grains/bates';
import { computeGrainPreview } from '../preview';

describe('computeGrainPreview.areaProfile', () => {
  it('is the burning perimeter, which INCREASES as a BATES grain regresses (its core grows)', () => {
    const grain = BatesGrain.fromProperties({
      diameter: 0.08,
      length: 0.15,
      coreDiameter: 0.02,
      inhibitedEnds: 'Neither',
    });
    grain.simulationSetup({ mapDim: 400 });

    const preview = computeGrainPreview(grain, 200);
    const { areaProfile } = preview;

    expect(areaProfile.length).toBeGreaterThan(2);
    expect(areaProfile[0].perimeter).toBeGreaterThan(0);

    // Perimeter should trend up (allowing a little marching-squares/last-sample noise near
    // burnout) — the opposite of what remaining cross-sectional area would do.
    const first = areaProfile[0].perimeter;
    const middle = areaProfile[Math.floor(areaProfile.length / 2)].perimeter;
    expect(middle).toBeGreaterThan(first);

    // The first sample (regDist ~ 0) should be close to the core's exact analytic perimeter,
    // within the raster/marching-squares resolution used for this cheap preview.
    const analyticInitialPerimeter = geometry.circlePerimeter(grain.coreDiameter);
    expect(areaProfile[0].perimeter).toBeCloseTo(analyticInitialPerimeter, 1);
  });
});
