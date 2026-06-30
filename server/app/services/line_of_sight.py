"""Line-of-sight between mission control and a responder.

A mountain anywhere on the straight line between them blocks the signal. Pure
functions; the signal service / simulation worker feed in the positions and the
mountain set.
"""

Cell = tuple[int, int]


def cells_on_line(start: Cell, end: Cell) -> list[Cell]:
    """Every grid cell the straight line from start to end crosses (Bresenham's
    line algorithm). Both endpoints are included.

    `start` (mission control) may be OUTSIDE the grid (e.g. x = -2) — that's
    fine here: we just return the cells the line touches and let the caller
    ignore anything off-grid.
    """
    (x, y), (end_x, end_y) = start, end
    delta_x = abs(end_x - x)
    delta_y = abs(end_y - y)
    step_x = 1 if x < end_x else -1
    step_y = 1 if y < end_y else -1
    error = delta_x - delta_y

    cells: list[Cell] = []
    while True:
        cells.append((x, y))
        if (x, y) == (end_x, end_y):
            break
        double_error = 2 * error
        if double_error > -delta_y:
            error -= delta_y
            x += step_x
        if double_error < delta_x:
            error += delta_x
            y += step_y
    return cells


def has_line_of_sight(
    control: Cell,
    responder: Cell,
    mountains: set[Cell],
) -> tuple[bool, Cell | None]:
    """Is the view from mission control to the responder clear?

    Returns (is_clear, blocking_cell): blocking_cell is the first mountain found
    on the line, or None when the view is clear. The two endpoints themselves
    don't count as blockers.
    """
    for cell in cells_on_line(control, responder):
        if cell == control or cell == responder:
            continue
        if cell in mountains:
            return False, cell
    return True, None
