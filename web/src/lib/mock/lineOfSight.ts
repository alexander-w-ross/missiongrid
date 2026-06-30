/**
 * Line-of-sight check for the MOCK backend only (mirrors PRD 16.4).
 *
 * Uses a standard integer Bresenham line ("a grid line algorithm", per §16.4).
 * Note: this is NOT a supercover walk — on an exact diagonal it cuts the corner
 * and does not treat a mountain it merely grazes at a corner as blocking. The
 * PRD does not define corner-clip semantics; if the real backend chooses a
 * supercover line, mirror that change here so mock and server agree. Mission
 * control may sit outside the grid; only in-grid cells are tested against
 * terrain.
 */
import type { Point } from "../types";

const key = (x: number, y: number) => `${x},${y}`;

/** All integer cells the segment from a→b passes through (inclusive). */
export function cellsOnLine(a: Point, b: Point): Point[] {
  const cells: Point[] = [];
  let x0 = a.x;
  let y0 = a.y;
  const dx = Math.abs(b.x - x0);
  const dy = Math.abs(b.y - y0);
  const sx = x0 < b.x ? 1 : -1;
  const sy = y0 < b.y ? 1 : -1;
  let err = dx - dy;

  // Guard against pathological loops.
  const maxSteps = dx + dy + 2;
  let steps = 0;

  while (steps++ <= maxSteps) {
    cells.push({ x: x0, y: y0 });
    if (x0 === b.x && y0 === b.y) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return cells;
}

export interface LineOfSightResult {
  hasLineOfSight: boolean;
  blockedBy: Point | null;
}

export function hasLineOfSight(
  control: Point,
  responder: Point,
  mountains: Set<string>,
  width: number,
  height: number,
): LineOfSightResult {
  const cells = cellsOnLine(control, responder);
  for (const c of cells) {
    // Endpoints are the units themselves, never terrain.
    if (c.x === control.x && c.y === control.y) continue;
    if (c.x === responder.x && c.y === responder.y) continue;
    // Off-grid cells cannot hold terrain.
    if (c.x < 0 || c.y < 0 || c.x >= width || c.y >= height) continue;
    if (mountains.has(key(c.x, c.y))) {
      return { hasLineOfSight: false, blockedBy: c };
    }
  }
  return { hasLineOfSight: true, blockedBy: null };
}
