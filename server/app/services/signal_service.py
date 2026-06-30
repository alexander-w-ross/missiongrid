"""Derive a responder's signal status from line-of-sight. Pure function.

The simulation worker calls this whenever something that could change visibility
happens (responder moved, mission control moved, mountain placed/removed), then
compares the result to the responder's current status to decide whether to emit
SIGNAL_LOST or SIGNAL_RESTORED.
"""

from app.schemas.common import SignalStatus
from app.services.line_of_sight import has_line_of_sight

Cell = tuple[int, int]


def compute_signal_status(
    control: Cell,
    responder: Cell,
    mountains: set[Cell],
) -> tuple[SignalStatus, Cell | None]:
    """Return (signal_status, blocking_cell) for a responder.

    CONNECTED with blocking_cell None when the view is clear; BLOCKED with the
    offending mountain cell when a mountain sits on the line. (The RECONNECTING
    state belongs to the advanced reconnect flow, not this check.)
    """
    is_clear, blocking_cell = has_line_of_sight(control, responder, mountains)
    status = SignalStatus.CONNECTED if is_clear else SignalStatus.BLOCKED
    return status, blocking_cell
