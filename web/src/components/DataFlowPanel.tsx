"use client";

import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Network,
} from "lucide-react";
import { ArchitectureView } from "./ArchitectureView";
import { Panel } from "./Panel";

const ACTION_BTN =
  "flex items-center gap-1 border border-[color:var(--color-line-bright)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-faint)] transition-colors hover:text-[color:var(--color-muted)]";

/**
 * Center-column companion to the Tactical Display: hosts the live System Data
 * Flow diagram. It can be hidden to reclaim grid space, or expanded into a
 * large vertical split (with event-log replay) via the page-level layout.
 */
export function DataFlowPanel({
  collapsed,
  expanded,
  onToggle,
  onToggleExpand,
}: {
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onToggleExpand: () => void;
}) {
  return (
    <Panel
      title="System Data Flow"
      icon={<Network className="h-4 w-4" strokeWidth={2} />}
      action={
        <div className="flex items-center gap-1.5">
          {!collapsed && (
            <button
              onClick={onToggleExpand}
              aria-label={expanded ? "Restore data flow" : "Expand data flow"}
              className={ACTION_BTN}
            >
              {expanded ? (
                <>
                  <Minimize2 className="h-3 w-3" /> Restore
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3" /> Expand
                </>
              )}
            </button>
          )}
          {!expanded && (
            <button
              onClick={onToggle}
              aria-label={collapsed ? "Show data flow" : "Hide data flow"}
              className={ACTION_BTN}
            >
              {collapsed ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Show
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> Hide
                </>
              )}
            </button>
          )}
        </div>
      }
      className="h-full"
      bodyClassName={collapsed ? "hidden" : "p-2"}
    >
      {!collapsed && (
        <div className="h-full w-full">
          <ArchitectureView expanded={expanded} />
        </div>
      )}
    </Panel>
  );
}
