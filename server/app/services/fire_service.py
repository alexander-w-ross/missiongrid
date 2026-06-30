"""Fire intensity math for one simulation tick. Pure function."""

# How much intensity a single responder removes from a fire each tick.
EXTINGUISH_RATE_PER_TICK = 5


def apply_fire_tick(intensity: int, responders_on_fire: int) -> int:
    """The fire's new intensity after one tick.

    Every responder standing on the fire cell removes
    EXTINGUISH_RATE_PER_TICK; the result is clamped at 0 (a fire never goes
    negative). The caller decides what to emit: FIRE_INTENSITY_CHANGED while it
    drops, and FIRE_EXTINGUISHED once it hits 0.
    """
    return max(0, intensity - responders_on_fire * EXTINGUISH_RATE_PER_TICK)
