"""A* pathfinding on a 4-connected grid.

Pure functions, no DB/Kafka — easy to unit test. The simulation worker calls
find_path when dispatching a responder; mountains are the blocked cells.
"""

import heapq

Cell = tuple[int, int]


def find_path(
    start: Cell,
    goal: Cell,
    width: int,
    height: int,
    blocked: set[Cell],
) -> list[Cell] | None:
    """Shortest path from start to goal as a list of cells (both inclusive),
    or None if the goal can't be reached.

    `blocked` is the set of impassable (mountain) cells. The goal is assumed
    walkable — you dispatch a responder *onto* a fire cell, and fires never sit
    on mountains.
    """
    if start == goal:
        return [start]

    # Cells we still want to explore, as a min-heap ordered by the cheapest
    # *estimated* total trip cost. Each entry is (estimated_total_cost, cell).
    frontier: list[tuple[int, Cell]] = [(0, start)]

    # For each cell we've reached, the cell we came from — used to walk the
    # finished path backwards at the end.
    came_from: dict[Cell, Cell] = {}

    # Cheapest cost actually found so far to get from `start` to each cell.
    cost_from_start: dict[Cell, int] = {start: 0}

    while frontier:
        _, current = heapq.heappop(frontier)

        if current == goal:
            return _rebuild_path(came_from, current)

        for neighbor in _walkable_neighbors(current, width, height, blocked):
            # Every step on this grid costs 1.
            tentative_cost = cost_from_start[current] + 1

            # Only keep this route to `neighbor` if it's better than any we've
            # seen before (or the first time we've reached it).
            if tentative_cost < cost_from_start.get(neighbor, float("inf")):
                came_from[neighbor] = current
                cost_from_start[neighbor] = tentative_cost
                # f = g + h: known cost so far + optimistic guess to the goal.
                estimated_total_cost = tentative_cost + _manhattan_distance(neighbor, goal)
                heapq.heappush(frontier, (estimated_total_cost, neighbor))

    return None  # frontier drained without reaching the goal -> walled off


def _manhattan_distance(a: Cell, b: Cell) -> int:
    """Steps between two cells ignoring obstacles — the A* heuristic. Never
    overestimates on a 4-connected grid, which is what keeps A* optimal."""
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def _walkable_neighbors(cell: Cell, width: int, height: int, blocked: set[Cell]):
    """The up/down/left/right cells that are on the grid and not a mountain.
    No diagonals (matches the movement rules)."""
    x, y = cell
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        neighbor = (x + dx, y + dy)
        nx, ny = neighbor
        if 0 <= nx < width and 0 <= ny < height and neighbor not in blocked:
            yield neighbor


def _rebuild_path(came_from: dict[Cell, Cell], goal: Cell) -> list[Cell]:
    """Follow the came_from links from the goal back to the start, then flip it
    so the path reads start -> goal."""
    path = [goal]
    current = goal
    while current in came_from:
        current = came_from[current]
        path.append(current)
    path.reverse()
    return path
