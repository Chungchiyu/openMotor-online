import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { PerforatedGrain } from '../physics/grains/base';
import { cloneGrain } from '../physics/grains';
import { standardGravity } from '../physics/constants';
import { computeGrainPreview, type GrainPreview } from '../physics/preview';
import type { SimulationResult } from '../physics/simResult';
import { convert } from '../physics/units';
import { useUnits } from './UnitsContext';
import { GrainPreviewCanvas } from './GrainPreviewCanvas';

interface Props {
  result: SimulationResult;
}

interface StatRowProps {
  label: string;
  value: string;
}

function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

/**
 * One time slider driving a column-per-grain table (thumbnail + mass/mass flow/mass flux/web
 * stacked beneath each grain) and a Consumed/Remaining readout — matches the original desktop
 * app's layout top-to-bottom (`uilib/views/forms/ResultsWidget.ui`: grain table, then the
 * Consumed/Remaining group boxes, then the time slider at the bottom).
 */
export function TimeScrubberPanel({ result }: Props) {
  const { unitFor, precision } = useUnits();
  const numSteps = result.channels.time.length;
  const [stepIndex, setStepIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // A plain vertical mouse-wheel scroll pans this strip horizontally — without it, an ordinary
  // wheel gesture over a horizontally-scrolling box does nothing (it's not tall enough to have its
  // own vertical overflow) and the browser sends the scroll to whatever ancestor *does* scroll
  // vertically instead, which reads as "scrolling does nothing" here. Native shift+wheel/trackpad
  // horizontal swipes already arrive as deltaX and are left alone (early return) so they aren't
  // double-handled.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const previews = useMemo<(GrainPreview | null)[]>(
    () =>
      result.grains.map((g) => {
        // End Burner and Conical grains extend Grain directly, not PerforatedGrain — they have no
        // 2D cross-section to raster (an end burner's face is just its full unburned circle, not a
        // shape that regresses; a conical grain's core varies continuously along its length rather
        // than having one representative cross-section), so there's nothing for GrainPreviewCanvas
        // to draw. Checking this instead of blindly casting to PerforatedGrain turns an expected,
        // known case into an intentional null rather than a caught `getPreviewRaster is not a
        // function` exception standing in for it.
        if (!(g instanceof PerforatedGrain)) return null;
        try {
          // Preview generation mutates an FmmGrain's internal geometry cache (mapDim, coreMap, the
          // face-area/perimeter lookup tables) down to a small preview resolution. Doing that
          // directly on `g` — a grain the live SimulationResult still owns — would corrupt the
          // tables the simulation relies on (getPortArea -> getFaceArea would then throw once
          // they're gone); cloning first keeps the preview's mutation off to the side.
          return computeGrainPreview(cloneGrain(g) as PerforatedGrain);
        } catch (e) {
          console.error('Grain preview computation failed', e);
          return null;
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result],
  );

  const time = result.channels.time[stepIndex] ?? 0;

  // '{:.2f} {}'.format(convert(quantity, inUnit, convUnit), convUnit) — same convention as
  // SummaryStats' `stat`, kept local since it closes over this panel's own `unitFor`/`precision`.
  const stat = (quantity: number, inUnit: string): string => {
    const outUnit = unitFor(inUnit);
    return `${convert(quantity, inUnit, outUnit).toFixed(precision)}${outUnit ? ` ${outUnit}` : ''}`;
  };

  // Bare number, no unit suffix — the grain grid puts the unit once in the row's field-label cell
  // (via `fieldLabel`, below) instead of repeating it in every grain's value cell.
  const statValue = (quantity: number, inUnit: string): string => convert(quantity, inUnit, unitFor(inUnit)).toFixed(precision);

  const fieldLabel = (label: string, inUnit: string): string => {
    const outUnit = unitFor(inUnit);
    return outUnit ? `${label} (${outUnit})` : label;
  };

  const grainFields: { label: string; unit: string; values: (number | undefined)[] }[] = [
    { label: 'Mass', unit: 'kg', values: result.multiChannels.mass[stepIndex] ?? [] },
    { label: 'Mass Flow', unit: 'kg/s', values: result.multiChannels.massFlow[stepIndex] ?? [] },
    { label: 'Mass Flux', unit: 'kg/(m^2*s)', values: result.multiChannels.massFlux[stepIndex] ?? [] },
    { label: 'Web Left', unit: 'm', values: result.multiChannels.web[stepIndex] ?? [] },
  ];

  // Consumed/Remaining readout — ported from resultsWidget.py's updateTimeIndicators: getISP(index)
  // already averages impulse-so-far over mass-consumed-so-far (Consumed ISP); the Remaining side has
  // no matching SimulationResult method since it's the only quantity the original derives from the
  // other two rather than reading directly off a channel, so it's computed the same way here.
  const totalTime = result.getBurnTime();
  const totalImpulse = result.getImpulse();
  const totalMass = result.getPropellantMass();
  const currentImpulse = result.getImpulse(stepIndex);
  const currentMassRemaining = result.getPropellantMass(stepIndex);
  const consumedMass = totalMass - currentMassRemaining;
  const remainingImpulse = totalImpulse - currentImpulse;
  const remainingTime = totalTime - time;
  const consumedISP = result.getISP(stepIndex);
  const remainingISP = currentMassRemaining > 0 ? remainingImpulse / (currentMassRemaining * standardGravity) : 0;

  const progress = numSteps > 1 ? (stepIndex / (numSteps - 1)) * 100 : 0;
  const sliderStyle = { '--slider-progress': `${progress}%` } as CSSProperties;

  return (
    <div className="time-scrubber-panel">
      <div className="grains-table-scroll" ref={scrollRef}>
        {/* CSS grid, not a <table>: <table>'s own layout algorithm keeps a sticky <td> from ever
         * fully occluding a scrolled-under sibling cell regardless of z-index/isolation (a
         * table-specific painting quirk); a grid's sticky item is a plain block box, which avoids
         * that. Emitting each field's row as a Fragment of `1 + grainCount` flat children lets the
         * grid's implicit row-per-line auto-placement give the same one-row-per-field layout a
         * <table> would, with row heights still auto-aligning to each row's tallest cell. */}
        <div className="grains-grid" style={{ gridTemplateColumns: `auto repeat(${result.grains.length}, minmax(96px, 1fr))` }}>
          <div className="grain-field-col" />
          {result.grains.map((_, gid) => (
            <div key={gid} className="grains-grid-header">
              Grain {gid + 1}
            </div>
          ))}

          <div className="grain-field-col">Cross-section</div>
          {result.grains.map((grain, gid) => {
            const regression = result.multiChannels.regression[stepIndex]?.[gid] ?? 0;
            return (
              <div key={gid}>
                <GrainPreviewCanvas
                  preview={previews[gid]}
                  regDist={regression}
                  diameter={grain.diameter}
                  showContours={false}
                  size={96}
                />
              </div>
            );
          })}

          {grainFields.map((field) => (
            <Fragment key={field.label}>
              <div className="grain-field-col">{fieldLabel(field.label, field.unit)}</div>
              {result.grains.map((_, gid) => {
                const value = field.values[gid];
                return <div key={gid}>{value !== undefined ? statValue(value, field.unit) : '-'}</div>;
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="consumed-remaining">
        <div className="consumed-remaining-card">
          <h4>Consumed</h4>
          <StatRow label="Burn Time" value={stat(time, 's')} />
          <StatRow label="Impulse" value={stat(currentImpulse, 'Ns')} />
          <StatRow label="Propellant Mass" value={stat(consumedMass, 'kg')} />
          <StatRow label="ISP" value={stat(consumedISP, 's')} />
        </div>
        <div className="consumed-remaining-card">
          <h4>Remaining</h4>
          <StatRow label="Burn Time" value={stat(remainingTime, 's')} />
          <StatRow label="Impulse" value={stat(remainingImpulse, 'Ns')} />
          <StatRow label="Propellant Mass" value={stat(currentMassRemaining, 'kg')} />
          <StatRow label="ISP" value={stat(remainingISP, 's')} />
        </div>
      </div>

      <div className="time-scrubber-header">
        <span>t = {time.toFixed(3)}s</span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(numSteps - 1, 0)}
        value={stepIndex}
        onChange={(e) => setStepIndex(Number(e.target.value))}
        className="time-slider"
        style={sliderStyle}
      />
    </div>
  );
}
