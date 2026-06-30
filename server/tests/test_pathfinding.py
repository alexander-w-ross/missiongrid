from app.services.pathfinding import find_path


def test_direct_route_on_empty_grid():
    path = find_path((0, 0), (0, 2), 20, 20, set())
    assert path == [(0, 0), (0, 1), (0, 2)]


def test_start_equals_goal_is_single_cell():
    assert find_path((3, 3), (3, 3), 20, 20, set()) == [(3, 3)]


def test_routes_around_a_mountain():
    # A mountain directly between start and goal forces a detour.
    blocked = {(0, 1)}
    path = find_path((0, 0), (0, 2), 20, 20, blocked)
    assert path is not None
    assert path[0] == (0, 0) and path[-1] == (0, 2)
    assert (0, 1) not in path  # never walks through the mountain


def test_fully_blocked_returns_none():
    # (0,0)'s only on-grid neighbours are walled off -> unreachable goal.
    blocked = {(0, 1), (1, 0)}
    assert find_path((0, 0), (5, 5), 20, 20, blocked) is None


def test_path_is_contiguous_and_avoids_blocked():
    blocked = {(2, y) for y in range(0, 19)}  # a wall with a gap at the top row
    path = find_path((0, 0), (4, 0), 20, 20, blocked)
    assert path is not None
    # every consecutive pair differs by exactly one orthogonal step
    for (ax, ay), (bx, by) in zip(path, path[1:]):
        assert abs(ax - bx) + abs(ay - by) == 1
    assert not (set(path) & blocked)
