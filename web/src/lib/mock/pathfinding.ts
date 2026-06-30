/**
 * A* pathfinding for the MOCK backend only (mirrors PRD 16.3).
 *
 * 4-directional movement, Manhattan heuristic. The real implementation lives
 * server-side in app/services/pathfinding.py — this exists purely so the UI is
 * demoable without a server.
 */
import type { Point } from "../types";

const key = (x: number, y: number) => `${x},${y}`;

export function findPath(
  start: Point,
  target: Point,
  width: number,
  height: number,
  blocked: Set<string>,
): Point[] | null {
  if (start.x === target.x && start.y === target.y) return [{ ...start }];
  if (blocked.has(key(target.x, target.y))) return null;

  const open: { p: Point; f: number }[] = [{ p: start, f: 0 }];
  const cameFrom = new Map<string, Point>();
  const gScore = new Map<string, number>([[key(start.x, start.y), 0]]);

  const h = (p: Point) => Math.abs(p.x - target.x) + Math.abs(p.y - target.y);

  while (open.length > 0) {
    // Pop lowest f (small grid → linear scan is fine).
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!.p;
    const ck = key(current.x, current.y);

    if (current.x === target.x && current.y === target.y) {
      return reconstruct(cameFrom, current);
    }

    const neighbors: Point[] = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const n of neighbors) {
      if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue;
      const nk = key(n.x, n.y);
      if (blocked.has(nk)) continue;
      const tentative = (gScore.get(ck) ?? Infinity) + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, current);
        gScore.set(nk, tentative);
        open.push({ p: n, f: tentative + h(n) });
      }
    }
  }

  return null;
}

function reconstruct(cameFrom: Map<string, Point>, end: Point): Point[] {
  const path: Point[] = [end];
  let cur = end;
  let prev = cameFrom.get(key(cur.x, cur.y));
  while (prev) {
    path.unshift(prev);
    cur = prev;
    prev = cameFrom.get(key(cur.x, cur.y));
  }
  return path;
}
