from app.services.line_of_sight import cells_on_line, has_line_of_sight


def test_no_mountains_is_clear():
    is_clear, blocker = has_line_of_sight((0, 5), (10, 5), mountains=set())
    assert is_clear is True
    assert blocker is None


def test_mountain_on_the_line_blocks():
    is_clear, blocker = has_line_of_sight((0, 5), (10, 5), mountains={(4, 5)})
    assert is_clear is False
    assert blocker == (4, 5)


def test_mountain_off_the_line_is_clear():
    is_clear, _ = has_line_of_sight((0, 5), (10, 5), mountains={(4, 9)})
    assert is_clear is True


def test_endpoints_do_not_count_as_blockers():
    # A "mountain" sitting on the responder cell shouldn't block its own signal.
    is_clear, _ = has_line_of_sight((0, 5), (10, 5), mountains={(10, 5)})
    assert is_clear is True


def test_mission_control_off_grid_still_works():
    # Control at x=-2 (outside the grid) viewing a responder at (5, 2).
    line = cells_on_line((-2, 2), (5, 2))
    assert line[0] == (-2, 2) and line[-1] == (5, 2)
    is_clear, blocker = has_line_of_sight((-2, 2), (5, 2), mountains={(3, 2)})
    assert is_clear is False and blocker == (3, 2)
