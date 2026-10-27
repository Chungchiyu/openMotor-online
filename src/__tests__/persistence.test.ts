import { beforeEach, describe, expect, it } from 'vitest';
import { autosave, loadAutosave } from '../persistence';
import { defaultTransientSettings } from '../physics/transient/options';
import { defaultMotorConfig, defaultNozzle, type MotorDesign } from '../physics/types';

const design: MotorDesign = { grains: [], propellant: null, nozzle: defaultNozzle(), config: defaultMotorConfig() };

describe('autosave', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps the transient model settings beside the .ric', () => {
    const transient = { ...defaultTransientSettings(), enabled: true, calibration: true };
    autosave({ ...design, transient });
    expect(loadAutosave()?.transient).toEqual(transient);
  });

  it('forgets them once the design has none', () => {
    autosave({ ...design, transient: defaultTransientSettings() });
    autosave(design);
    expect(loadAutosave()?.transient).toBeUndefined();
  });
});
