import type { TransientOptions, TransientSettings } from '../physics/transient/options';
import { CheckboxField, NumberField, SelectField } from './fields';

interface Props {
  settings: TransientSettings;
  /** The design's nozzle efficiency — what Calibration's nozzle efficiency starts from. */
  nozzleEfficiency: number;
  onChange: (settings: TransientSettings) => void;
}

/**
 * The transient model's settings (physics/transient/): a master switch, one switch per effect, and
 * each effect's options, shown only while its switch is on. Every switch that is off leaves that
 * part of the model as openMotor has it.
 */
export function TransientForm({ settings, nozzleEfficiency, onChange }: Props) {
  const o = settings.options;
  const set = (patch: Partial<TransientSettings>) => onChange({ ...settings, ...patch });
  const setOpt = (patch: Partial<TransientOptions>) => onChange({ ...settings, options: { ...o, ...patch } });

  return (
    <div className="property-editor-form">
      <CheckboxField label="Use Transient Model" value={settings.enabled} onChange={(enabled) => set({ enabled })} />
      <div className="field-note">
        Steps the gas mass in the chamber instead of assuming a steady pressure: the chamber fills at ignition and blows down
        at burnout. The switches below add what static tests show openMotor leaves out (sugar-ballistics model, as in
        diver-sim). Off: openMotor's simulation, unchanged.
      </div>
      <CheckboxField
        label="Compare With openMotor"
        value={settings.compareBaseline}
        onChange={(compareBaseline) => set({ compareBaseline })}
      />

      <h4>Ignition</h4>
      <CheckboxField label="Ignition Transient" value={settings.ignition} onChange={(ignition) => set({ ignition })} />
      {settings.ignition ? (
        <>
          <NumberField label="Igniter Pressure" unitKind="Pa" value={o.igniterPressure} onChange={(v) => setOpt({ igniterPressure: v })} />
          <NumberField label="Igniter Time" unit="s" value={o.igniterTime} onChange={(v) => setOpt({ igniterTime: v })} />
          <SelectField
            label="Igniter Profile"
            value={o.igniterProfile}
            options={[
              { value: 'step', label: 'Step' },
              { value: 'decay', label: 'Decay' },
            ]}
            onChange={(igniterProfile) => setOpt({ igniterProfile })}
          />
          <NumberField label="Nozzle Plug Burst (gauge)" unitKind="Pa" value={o.plugBurst} min={0} onChange={(v) => setOpt({ plugBurst: v })} />
          <NumberField label="Core Flame Spread Time" unit="s" value={o.tauCore} onChange={(v) => setOpt({ tauCore: v })} />
          <NumberField label="End Flame Spread Time" unit="s" value={o.tauEnd} onChange={(v) => setOpt({ tauEnd: v })} />
          <NumberField label="Ends Start (fraction of core)" value={o.endStart} onChange={(v) => setOpt({ endStart: v })} />
          <SelectField
            label="Ignition Shape"
            value={o.ignitionShape}
            options={[
              { value: 'linear', label: 'Linear' },
              { value: 'smooth', label: 'Smooth' },
            ]}
            onChange={(ignitionShape) => setOpt({ ignitionShape })}
          />
          <NumberField
            label="Spread Reference Length"
            unitKind="m"
            value={o.spreadRefLength}
            min={0}
            onChange={(v) => setOpt({ spreadRefLength: v })}
          />
          <NumberField label="Spread Pressure Exponent" value={o.spreadExponent} onChange={(v) => setOpt({ spreadExponent: v })} />
          <NumberField label="Spread Reference Pressure" unitKind="Pa" value={o.pRef} onChange={(v) => setOpt({ pRef: v })} />
          <div className="field-note">
            Igniter gas as this chamber pressure would need, a nozzle plug (0: none), and the flame spreading over the cores,
            then the ends. A spread reference length above 0 scales the spread times by the total grain length over it.
          </div>
        </>
      ) : (
        <div className="field-note">Off: every surface burns from t = 0.</div>
      )}

      <h4>Tail-off</h4>
      <CheckboxField label="Burnout Web Spread" value={settings.tailOff} onChange={(tailOff) => set({ tailOff })} />
      {settings.tailOff ? (
        <>
          <NumberField label="Web Spread (fraction of web)" value={o.ecc} min={0} onChange={(v) => setOpt({ ecc: v })} />
          <div className="field-note">Each grain burns out over a normal spread of webs (sigma = half this, at most 3 mm).</div>
        </>
      ) : (
        <div className="field-note">Off: each grain burns out at once.</div>
      )}

      <h4>Burn Rate</h4>
      <CheckboxField
        label="Smooth Across Bands"
        value={settings.smoothBurnRate}
        onChange={(smoothBurnRate) => set({ smoothBurnRate })}
      />
      {settings.smoothBurnRate ? (
        <>
          <NumberField label="Blend Width (ln p)" value={o.bandBlend} min={0} onChange={(v) => setOpt({ bandBlend: v })} />
          <div className="field-note">Blends the propellant's bands across each edge, so the burn rate has no kinks.</div>
        </>
      ) : (
        <div className="field-note">Off: the propellant's bands as entered.</div>
      )}

      <h4>Calibration</h4>
      <CheckboxField
        label="Static Firing Calibration"
        value={settings.calibration}
        onChange={(calibration) =>
          // Start the nozzle efficiency from the design's own, which is what it was until now.
          set(calibration && !settings.calibration ? { calibration, options: { ...o, etaNozzle: nozzleEfficiency } } : { calibration })
        }
      />
      {settings.calibration ? (
        <>
          <NumberField label="c* Efficiency" value={o.etaCstar} onChange={(v) => setOpt({ etaCstar: v })} />
          <NumberField label="Burn Rate Scale" value={o.burnRateScale} onChange={(v) => setOpt({ burnRateScale: v })} />
          <NumberField label="Nozzle Efficiency" value={o.etaNozzle} onChange={(v) => setOpt({ etaNozzle: v })} />
          <div className="field-note">
            From your own firing: delivered over ideal c* (0.975 = openMotor's), a factor on the burn rate coefficient, and a
            factor on the thrust coefficient (used instead of the nozzle's efficiency).
          </div>
        </>
      ) : (
        <div className="field-note">Off: openMotor's c*, the propellant's burn rate and the nozzle's efficiency.</div>
      )}

      <h4>Integration</h4>
      <NumberField label="Timestep" unit="s" value={o.dt} min={0} onChange={(v) => setOpt({ dt: v })} />
      <NumberField label="Maximum Time" unit="s" value={o.tMax} min={0} onChange={(v) => setOpt({ tMax: v })} />
      <NumberField
        label="Extra Free Volume"
        unitKind="m^3"
        value={o.freeVolumeExtra}
        min={0}
        onChange={(v) => setOpt({ freeVolumeExtra: v })}
      />
      <div className="field-note">Chamber volume beyond the grain envelopes (nozzle convergence, gaps). An end burner needs some.</div>
    </div>
  );
}
