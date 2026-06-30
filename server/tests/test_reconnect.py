"""Phase 8: blackout buffering in the tick + reconciliation event building."""

from app.services import simulation_service as sim
from app.services.simulation_service import MissionStateLocal, ResponderState
from app.services.reconciliation_service import build_reconciliation_events


def _types(events):
    return [str(e.type) for e in events]


def _mission_with_blocked_path():
    # Control at (0,0). Mountain at (2,2) lies on the sight line to (3,3) but not
    # on the responder's path, so movement is fine while line-of-sight is blocked.
    mission = MissionStateLocal(mission_id="m", width=20, height=20, control=(0, 0),
                                mountains={(2, 2)})
    # path: (3,4) -> (3,3) [blocked behind the mountain] -> (1,1) [clear again]
    r = ResponderState(id="11111111-1111-1111-1111-111111111111", name="R",
                       x=3, y=4, last_known_x=3, last_known_y=4,
                       status="moving", signal_status="connected",
                       path=[(3, 4), (3, 3), (1, 1)], path_index=0)
    mission.responders[r.id] = r
    return mission, r


def test_blocked_move_is_buffered_not_emitted():
    mission, r = _mission_with_blocked_path()
    world = {"m": mission}
    events = sim.run_tick("m", world)
    # moved to (3,3), behind the mountain -> no public RESPONDER_MOVED, SIGNAL_LOST
    assert "RESPONDER_MOVED" not in _types(events)
    assert "SIGNAL_LOST" in _types(events)
    assert r.local_log == [{"x": 3, "y": 3}]          # buffered locally
    assert (r.last_known_x, r.last_known_y) == (3, 4)  # frozen at last seen cell


def test_reconnect_emits_move_and_restore_keeps_backlog():
    mission, r = _mission_with_blocked_path()
    world = {"m": mission}
    sim.run_tick("m", world)              # -> (3,3) blocked, buffered
    events = sim.run_tick("m", world)     # -> (1,1) clear again, reconnect
    assert "RESPONDER_MOVED" in _types(events)
    assert "SIGNAL_RESTORED" in _types(events)
    assert r.signal_status == "connected"
    assert r.local_log == [{"x": 3, "y": 3}]  # still buffered; the worker flushes it


def test_build_reconciliation_events():
    telemetry = {
        "id": "t1", "type": "RESPONDER_TELEMETRY_UPLOADED",
        "mission_id": "m", "responder_id": "r1",
        "final_position": {"x": 1, "y": 1},
        "backlog": [{"x": 3, "y": 3}],
    }
    events = build_reconciliation_events(telemetry)
    assert _types(events) == ["RESPONDER_RECONNECTED", "RESPONDER_POSITION_RECONCILED"]
    assert events[1].payload["position"] == {"x": 1, "y": 1}
