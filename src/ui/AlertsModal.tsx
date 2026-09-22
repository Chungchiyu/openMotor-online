import type { SimAlert } from '../physics/types';
import { AlertsTable } from './AlertsTable';

interface Props {
  alerts: SimAlert[];
  onClose: () => void;
}

/** Pops up right after a simulation finishes if there are any alerts, so they can't be missed —
 * matching the original desktop app's SimulationAlertsDialog, instead of only surfacing alerts in
 * a tab the user has to think to click into. */
export function AlertsModal({ alerts, onClose }: Props) {
  return (
    <div className="about-dialog-backdrop" onClick={onClose}>
      <div className="alerts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="propellant-editor-header">
          <h2>Simulation Alerts</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="alerts-modal-body">
          <AlertsTable alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
