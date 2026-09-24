import type { Theme } from './useTheme';

interface Props {
  theme: Theme;
  onToggle: () => void;
}

/** Sliding light/dark switch with a fixed sun icon at one end and moon at the other — the thumb
 * slides to match the active theme rather than the icons swapping places. */
export function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={theme === 'dark'}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      onClick={onToggle}
    >
      <svg className="theme-toggle-icon" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="3.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M8 0.5v2M8 13.5v2M15.5 8h-2M2.5 8h-2M13.03 2.97l-1.4 1.4M4.37 11.63l-1.4 1.4M13.03 13.03l-1.4-1.4M4.37 4.37l-1.4-1.4" />
        </g>
      </svg>
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb" />
      </span>
      <svg className="theme-toggle-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M14 9.8A6.2 6.2 0 0 1 6.2 2a6.2 6.2 0 1 0 7.8 7.8Z"
        />
      </svg>
    </button>
  );
}
