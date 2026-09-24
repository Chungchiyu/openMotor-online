import { useState } from 'react';
import type { Grain } from '../physics/grains/base';
import type { GrainPreview } from '../physics/preview';
import { AlertsTable } from './AlertsTable';
import { AreaGraph } from './AreaGraph';
import { GrainPreviewCanvas } from './GrainPreviewCanvas';

interface Props {
  preview: GrainPreview | null;
  // The base type, not PerforatedGrain: this only ever calls grain.getGeometryErrors(), which
  // every grain has — End Burner and Conical grains (no 2D cross-section, so always `preview:
  // null` here) are legitimate callers too, not just the ones a preview can be rastered for.
  grain: Grain | null;
}

type Tab = 'face' | 'regression' | 'area' | 'alerts';

/** The grain preview's own small tab strip — Face (current shape), Regression (shape + evenly
 * spaced regression contours), Area Graph (face area vs. regression depth) and Alerts (this
 * grain's own geometry errors/warnings) — mirroring the original desktop app's grain preview
 * widget, which has the same four tabs. */
export function GrainPreviewPanel({ preview, grain }: Props) {
  const [tab, setTab] = useState<Tab>('regression');
  const alerts = grain?.getGeometryErrors() ?? [];

  return (
    <div className="grain-preview-panel">
      <div className="tab-bar small">
        <button className={tab === 'face' ? 'active' : ''} onClick={() => setTab('face')}>
          Face
        </button>
        <button className={tab === 'regression' ? 'active' : ''} onClick={() => setTab('regression')}>
          Regression
        </button>
        <button className={tab === 'area' ? 'active' : ''} onClick={() => setTab('area')}>
          Area Graph
        </button>
        <button className={tab === 'alerts' ? 'active' : ''} onClick={() => setTab('alerts')}>
          Alerts {alerts.length > 0 ? `(${alerts.length})` : ''}
        </button>
      </div>

      {tab === 'face' && <GrainPreviewCanvas preview={preview} showContours={false} size={120} className="grain-face-canvas" />}
      {tab === 'regression' && <GrainPreviewCanvas preview={preview} showContours size={120} className="grain-face-canvas" />}
      {tab === 'area' && (preview ? <AreaGraph areaProfile={preview.areaProfile} /> : <div className="chart-placeholder">No preview</div>)}
      {tab === 'alerts' && <AlertsTable alerts={alerts} />}
    </div>
  );
}
