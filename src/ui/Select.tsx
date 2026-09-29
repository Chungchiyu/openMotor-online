import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Shown when `value` doesn't match any option (e.g. "" before a choice is made). */
  placeholder?: string;
  /** Accessible name for the trigger. Callers must NOT wrap this in a <label> — clicking anywhere
   * inside a <label> (including on an <li> deep in the open listbox) makes the browser forward a
   * second, synthetic click to the label's associated control, silently reopening the popup right
   * after a selection. Pass the field's label text here instead of relying on <label> wrapping. */
  ariaLabel?: string;
  className?: string;
}

// A hand-rolled replacement for native <select>: browsers render the native option-list popup
// outside the normal DOM/CSS pipeline, so its hover highlight and scrollbar can't be restyled to
// match the app's theme (see App.css's global scrollbar rules and --accent-bg hover convention,
// neither of which a native <select> popup honors). This gets full styling control back at the
// cost of reimplementing basic listbox keyboard behavior, viewport-edge flipping, and stable sizing
// that a native <select> gets for free from the browser.
export function Select<T extends string>({ value, options, onChange, placeholder, ariaLabel, className }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [openUpward, setOpenUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) setHighlighted(selectedIndex < 0 ? 0 : selectedIndex);
    // Only reset the highlight when the popup opens, not on every value/options change — the eslint
    // rule wants selectedIndex listed, but that would fight the arrow-key highlight below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Flips the popup above the trigger when it doesn't fit below — matching what a native <select>
  // does automatically. Runs in a layout effect (measure + setState before paint) so a flip never
  // flashes downward first: the popup mounts, we read its real rendered height off the DOM, decide,
  // and only then does the browser paint.
  useLayoutEffect(() => {
    if (!open) {
      setOpenUpward(false);
      return;
    }
    const trigger = rootRef.current;
    const list = listRef.current;
    if (!trigger || !list) return;
    const triggerRect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    setOpenUpward(list.offsetHeight > spaceBelow && spaceAbove > spaceBelow);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, highlighted]);

  const commit = (index: number) => {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(highlighted);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Home':
        e.preventDefault();
        setHighlighted(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlighted(options.length - 1);
        break;
    }
  };

  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : placeholder;

  return (
    <div className={`select-root${className ? ` ${className}` : ''}`} ref={rootRef}>
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className={selectedIndex < 0 ? 'select-placeholder' : undefined}>{selectedLabel}</span>
        <span className="select-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {/* Stacked in the same grid cell as the trigger (see .select-root) so the widest row — whichever
       * that is, trigger or sizer — sets the shared column width. Keeps the control a stable width no
       * matter which option is currently selected, instead of resizing to fit only that one label. */}
      <div className="select-sizer" aria-hidden="true">
        {placeholder && (
          <div className="select-trigger">
            <span>{placeholder}</span>
            <span className="select-caret">▾</span>
          </div>
        )}
        {options.map((o) => (
          <div className="select-trigger" key={o.value}>
            <span>{o.label}</span>
            <span className="select-caret">▾</span>
          </div>
        ))}
      </div>
      {open && (
        <ul className={`select-listbox${openUpward ? ' select-listbox-up' : ''}`} role="listbox" ref={listRef}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === selectedIndex}
              className={`select-option${i === highlighted ? ' highlighted' : ''}`}
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
