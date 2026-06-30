from app.services.fire_service import EXTINGUISH_RATE_PER_TICK, apply_fire_tick


def test_one_responder_reduces_by_rate():
    assert apply_fire_tick(100, 1) == 100 - EXTINGUISH_RATE_PER_TICK


def test_multiple_responders_stack():
    assert apply_fire_tick(100, 3) == 100 - 3 * EXTINGUISH_RATE_PER_TICK


def test_no_responders_no_change():
    assert apply_fire_tick(100, 0) == 100


def test_intensity_clamps_at_zero():
    # More than enough responders to overshoot -> never goes negative.
    assert apply_fire_tick(3, 5) == 0
