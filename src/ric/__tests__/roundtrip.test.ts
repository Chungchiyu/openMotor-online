import { describe, expect, it } from 'vitest';
import { presetPropellants } from '../../physics/presetPropellants';
import { defaultMotorConfig, defaultNozzle, type MotorDesign } from '../../physics/types';
import { exportMotorRic, exportPropellantsRic, importMotorRic, importPropellantsRic, RicFormatError } from '../index';
import { parseRicEnvelope, RIC_APP_VERSION, RicFileType } from '../envelope';

function sampleDesign(): MotorDesign {
  return {
    grains: [
      { type: 'BATES', properties: { diameter: 0.05, length: 0.1, coreDiameter: 0.02, inhibitedEnds: 'Neither' } },
      {
        type: 'Star Grain',
        properties: { diameter: 0.05, length: 0.1, numPoints: 5, pointLength: 0.01, pointWidth: 0.005, inhibitedEnds: 'Top' },
      },
    ],
    propellant: presetPropellants[0],
    nozzle: defaultNozzle(),
    config: defaultMotorConfig(),
  };
}

describe('.ric round trip', () => {
  it('exports and re-imports a motor design unchanged', () => {
    const design = sampleDesign();
    const text = exportMotorRic(design);
    const { design: reimported, errors } = importMotorRic(text);
    expect(errors).toEqual([]);
    expect(reimported).toEqual(design);
  });

  it('writes the envelope with tags the real Python loader requires (not plain int/list)', () => {
    const text = exportMotorRic(sampleDesign());
    expect(text).toContain('type: !!python/object/apply:uilib.fileIO.fileTypes [3]');
    expect(text).toContain(`version: !!python/tuple [${RIC_APP_VERSION.join(', ')}]`);
    const envelope = parseRicEnvelope(text);
    expect(envelope.type).toBe(RicFileType.MOTOR);
    expect(envelope.version).toEqual(RIC_APP_VERSION);
  });

  it('exports and re-imports a propellant library unchanged', () => {
    const text = exportPropellantsRic(presetPropellants);
    const reimported = importPropellantsRic(text);
    expect(reimported).toEqual(presetPropellants);
  });

  it('rejects a file of the wrong type', () => {
    const text = exportPropellantsRic(presetPropellants);
    expect(() => importMotorRic(text)).toThrow(RicFormatError);
  });

  it('rejects a file from a future version', () => {
    const text = exportMotorRic(sampleDesign()).replace(/version: !!python\/tuple \[.*\]/, 'version: !!python/tuple [9, 9, 9]');
    expect(() => importMotorRic(text)).toThrow(/future version/);
  });

  it('rejects a malformed file missing required envelope fields', () => {
    expect(() => importMotorRic('foo: bar')).toThrow(RicFormatError);
  });
});
