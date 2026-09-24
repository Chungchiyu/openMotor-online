import { useEffect, useMemo, useRef, useState } from 'react';
import type { MotorDesign } from '../physics/types';
import { downloadTextFile } from '../persistence';
import { exportMotorRic, importMotorRic } from '../ric';
import {
  createDesignRecord,
  deleteDesignRecord,
  duplicateDesignRecord,
  listDesignRecords,
  updateDesignRecord,
  type DesignRecord,
} from '../storage/designStore';

interface Props {
  currentDesign: MotorDesign;
  onClose: () => void;
  /** Loads `record` into the editor and closes the dialog. */
  onOpenDesign: (record: DesignRecord) => void;
  /** The current in-editor design was saved as a brand-new record — the caller should start
   * tracking it as "the open file" so the next plain Save overwrites it instead of prompting again. */
  onSavedAsNew: (record: DesignRecord) => void;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function FileManagerDialog({ currentDesign, onClose, onOpenDesign, onSavedAsNew }: Props) {
  const [records, setRecords] = useState<DesignRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setRecords(await listDesignRecords());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const r of records ?? []) for (const t of r.tags) tags.add(t);
    return [...tags].sort();
  }, [records]);

  const visibleRecords = useMemo(() => {
    return (records ?? []).filter((r) => {
      if (tagFilter && !r.tags.includes(tagFilter)) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [records, search, tagFilter]);

  const handleSaveCurrentAsNew = async () => {
    const name = window.prompt('Save the current design as:', 'motor');
    if (!name) return;
    const record = await createDesignRecord(name, currentDesign);
    onSavedAsNew(record);
    await refresh();
  };

  const handleDelete = async (record: DesignRecord) => {
    if (!window.confirm(`Delete "${record.name}"? This can't be undone.`)) return;
    await deleteDesignRecord(record.id);
    await refresh();
  };

  const handleDuplicate = async (record: DesignRecord) => {
    const name = window.prompt('Duplicate as:', `${record.name} (copy)`);
    if (!name) return;
    await duplicateDesignRecord(record.id, name);
    await refresh();
  };

  const startRename = (record: DesignRecord) => {
    setRenamingId(record.id);
    setRenameDraft(record.name);
  };

  const commitRename = async (id: string) => {
    setRenamingId(null);
    if (!renameDraft.trim()) return;
    await updateDesignRecord(id, { name: renameDraft.trim() });
    await refresh();
  };

  const handleTagsChange = async (record: DesignRecord, tagsText: string) => {
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    await updateDesignRecord(record.id, { tags });
    await refresh();
  };

  const handleExport = (record: DesignRecord) => {
    downloadTextFile(exportMotorRic(record.design), `${record.name}.ric`, 'application/x-yaml');
  };

  const handleImportClick = () => importInputRef.current?.click();

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const { design, errors } = importMotorRic(text);
      const name = file.name.replace(/\.ric$/i, '');
      await createDesignRecord(name, design);
      await refresh();
      if (errors.length > 0) setError(errors.join(' '));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that .ric file.');
    }
  };

  return (
    <div className="about-dialog-backdrop" onClick={onClose}>
      <div className="file-manager-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="file-manager-header">
          <h2>File Manager</h2>
          <button onClick={onClose}>Close</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="file-manager-toolbar">
          <input
            className="file-manager-search"
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={() => void handleSaveCurrentAsNew()}>Save Current As New</button>
          <button onClick={handleImportClick}>Import .ric…</button>
          <input
            ref={importInputRef}
            type="file"
            accept=".ric"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = '';
            }}
          />
        </div>

        {allTags.length > 0 && (
          <div className="file-manager-tag-filters">
            <button className={tagFilter === null ? 'selected' : ''} onClick={() => setTagFilter(null)}>
              All
            </button>
            {allTags.map((tag) => (
              <button key={tag} className={tagFilter === tag ? 'selected' : ''} onClick={() => setTagFilter(tag)}>
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="file-manager-list">
          {records === null ? (
            <div className="file-manager-empty">Loading…</div>
          ) : visibleRecords.length === 0 ? (
            <div className="file-manager-empty">{records.length === 0 ? 'No saved designs yet.' : 'No designs match this filter.'}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Tags</th>
                  <th>Last saved</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      {renamingId === record.id ? (
                        <input
                          autoFocus
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={() => void commitRename(record.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitRename(record.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                        />
                      ) : (
                        // Double-click renames (not opens) — the row's own "Open" button handles opening.
                        // A dblclick fires two click events before the dblclick itself, so an onClick
                        // here would open (and close this dialog) before the rename ever triggered.
                        <button className="link-button" onDoubleClick={() => startRename(record)} title="Double-click to rename">
                          {record.name}
                        </button>
                      )}
                    </td>
                    <td>
                      <input
                        className="file-manager-tags-input"
                        defaultValue={record.tags.join(', ')}
                        placeholder="tags, comma, separated"
                        onBlur={(e) => void handleTagsChange(record, e.target.value)}
                      />
                    </td>
                    <td>{formatDate(record.updatedAt)}</td>
                    <td className="file-manager-row-actions">
                      <button onClick={() => onOpenDesign(record)}>Open</button>
                      <button onClick={() => startRename(record)}>Rename</button>
                      <button onClick={() => void handleDuplicate(record)}>Duplicate</button>
                      <button onClick={() => handleExport(record)}>Export .ric</button>
                      <button onClick={() => void handleDelete(record)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
