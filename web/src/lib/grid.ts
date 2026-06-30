/** Shared SVG geometry for the mission field. Purely presentational. */
import { GRID } from "./config";

/** SVG user units per cell. The SVG scales responsively via viewBox. */
export const CELL = 26;
export const GUTTER = GRID.gutter;

export function originX(): number {
  return GUTTER * CELL;
}
export function originY(): number {
  return GUTTER * CELL;
}

/** Top-left pixel of a cell (grid coords may be negative / off-grid). */
export function cellTopLeft(x: number, y: number): { px: number; py: number } {
  return { px: (x + GUTTER) * CELL, py: (y + GUTTER) * CELL };
}

/** Center pixel of a cell. */
export function cellCenter(x: number, y: number): { cx: number; cy: number } {
  return { cx: (x + GUTTER + 0.5) * CELL, cy: (y + GUTTER + 0.5) * CELL };
}

export function fieldSize(width: number, height: number) {
  return {
    w: (width + GUTTER * 2) * CELL,
    h: (height + GUTTER * 2) * CELL,
  };
}

/** Convert a pixel coordinate (in SVG user space) back to a cell. */
export function pxToCell(px: number, py: number): { x: number; y: number } {
  return {
    x: Math.floor(px / CELL) - GUTTER,
    y: Math.floor(py / CELL) - GUTTER,
  };
}
