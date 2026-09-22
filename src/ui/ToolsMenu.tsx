import { useState } from 'react';
import { toolCategories, toolsByCategory, type ToolDef } from '../physics/tools';
import type { MotorDesign } from '../physics/types';
import { ToolDialog } from './ToolDialog';

interface Props {
  design: MotorDesign;
  onApply: (next: MotorDesign) => void;
}

/** The Tools menu item — Set / Optimize / Design / Analyze, matching uilib/toolManager.py's
 * category grouping, flattened into one dropdown with group headings rather than nested submenus
 * (same controls, simpler menu chrome). */
export function ToolsMenu({ design, onApply }: Props) {
  const [openTool, setOpenTool] = useState<ToolDef | null>(null);

  return (
    <>
      <div className="menu-item">
        <span className="menu-label">Tools</span>
        <div className="menu-dropdown tools-dropdown">
          {toolCategories.map((category) => (
            <div key={category} className="tools-dropdown-group">
              <div className="tools-dropdown-heading">{category}</div>
              {toolsByCategory(category).map((tool) => (
                <button key={tool.name} onClick={() => setOpenTool(tool)}>
                  {tool.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {openTool && (
        <ToolDialog
          tool={openTool}
          design={design}
          onApply={onApply}
          onClose={() => setOpenTool(null)}
        />
      )}
    </>
  );
}
