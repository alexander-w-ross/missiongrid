from app.services import simulation_service as sim


def _cmd(type_, mission_id, payload, cid):
    return {
        "id": cid,
        "type": type_,
        "mission_id": mission_id,
        "correlation_id": "corr_test",
        "payload": payload,
    }


def _types(events):
    return [str(e.type) for e in events]


def test_dispatch_moves_responder_and_extinguishes_fire():
    world = {}
    sim.handle_command(_cmd("CREATE_MISSION", "m", {"name": "n", "width": 20, "height": 20}, "c1"), world)

    fire_events = sim.handle_command(_cmd("PLACE_FIRE", "m", {"x": 5, "y": 5, "intensity": 10}, "c2"), world)
    fire_id = fire_events[0].payload["fire"]["id"]

    resp_events = sim.handle_command(_cmd("CREATE_RESPONDER", "m", {"name": "R", "x": 5, "y": 3}, "c3"), world)
    responder_id = resp_events[0].payload["responder"]["id"]

    dispatch_events = sim.handle_command(
        _cmd("DISPATCH_RESPONDER", "m", {"responder_id": responder_id, "fire_id": fire_id}, "c4"), world
    )
    assert "RESPONDER_DISPATCHED" in _types(dispatch_events)
    assert "RESPONDER_PATH_ASSIGNED" in _types(dispatch_events)

    # distance is 2 cells -> a few ticks to arrive
    for _ in range(5):
        sim.run_tick("m", world)
    responder = world["m"].responders[responder_id]
    assert (responder.x, responder.y) == (5, 5)
    assert str(responder.status) == "fighting_fire"

    # intensity 10, rate 5, one responder -> extinguished within a couple ticks
    for _ in range(5):
        sim.run_tick("m", world)
    assert str(world["m"].fires[fire_id].status) == "extinguished"


def test_route_not_found_when_walled_in():
    world = {}
    sim.handle_command(_cmd("CREATE_MISSION", "m", {"name": "n", "width": 5, "height": 5}, "c1"), world)
    fire_events = sim.handle_command(_cmd("PLACE_FIRE", "m", {"x": 4, "y": 4, "intensity": 100}, "c2"), world)
    fire_id = fire_events[0].payload["fire"]["id"]
    resp_events = sim.handle_command(_cmd("CREATE_RESPONDER", "m", {"name": "R", "x": 0, "y": 0}, "c3"), world)
    responder_id = resp_events[0].payload["responder"]["id"]
    # wall the responder into its corner
    sim.handle_command(_cmd("PLACE_MOUNTAIN", "m", {"x": 0, "y": 1}, "c4"), world)
    sim.handle_command(_cmd("PLACE_MOUNTAIN", "m", {"x": 1, "y": 0}, "c5"), world)

    events = sim.handle_command(
        _cmd("DISPATCH_RESPONDER", "m", {"responder_id": responder_id, "fire_id": fire_id}, "c6"), world
    )
    assert "ROUTE_NOT_FOUND" in _types(events)
    assert str(world["m"].responders[responder_id].status) == "idle"


def test_moving_control_behind_mountain_loses_signal():
    world = {}
    sim.handle_command(_cmd("CREATE_MISSION", "m", {"name": "n", "width": 20, "height": 20}, "c1"), world)
    sim.handle_command(_cmd("CREATE_RESPONDER", "m", {"name": "R", "x": 10, "y": 10}, "c2"), world)
    # a mountain between a control position to the right and the responder
    sim.handle_command(_cmd("PLACE_MOUNTAIN", "m", {"x": 15, "y": 10}, "c3"), world)
    events = sim.handle_command(_cmd("MOVE_MISSION_CONTROL", "m", {"x": 20, "y": 10}, "c4"), world)
    assert "MISSION_CONTROL_MOVED" in _types(events)
    assert "SIGNAL_LOST" in _types(events)
