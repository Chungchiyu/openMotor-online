import { SimAlertLevel, type SimAlert } from '../physics/types';

interface Props {
  alerts: SimAlert[];
}

const levelClass: Record<SimAlertLevel, string> = {
  [SimAlertLevel.ERROR]: 'alert-error',
  [SimAlertLevel.WARNING]: 'alert-warning',
  [SimAlertLevel.MESSAGE]: 'alert-message',
};

export function AlertsTable({ alerts }: Props) {
  if (alerts.length === 0) return <div className="alerts-table empty">No alerts.</div>;
  return (
    <table className="alerts-table">
      <thead>
        <tr>
          <th>Level</th>
          <th>Location</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {alerts.map((a, i) => (
          <tr key={i} className={levelClass[a.level]}>
            <td>{a.level}</td>
            <td>{a.location ?? '-'}</td>
            <td>{a.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
