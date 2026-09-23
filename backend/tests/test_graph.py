"""Unit tests for the conflict graph and DSATUR coloring."""
import pytest
from app.algorithms.graph import ConflictGraph, SessionNode, new_session_id
from app.algorithms.coloring import dsatur, greedy_coloring, assign_time_slots
from app.models.base import TimeSlot
from datetime import time


class TestConflictGraph:
    """Tests for conflict graph construction."""

    def test_add_node(self):
        g = ConflictGraph()
        n = SessionNode(id=new_session_id(), course_id=1, section_id=1,
                        faculty_id=1, requires_lab=False, requires_projector=True, capacity=30)
        g.add_node(n)
        assert len(g) == 1
        assert n.id in g.nodes

    def test_add_edge(self):
        g = ConflictGraph()
        a = SessionNode(id="a", course_id=1, section_id=1, faculty_id=1,
                        requires_lab=False, requires_projector=True, capacity=30)
        b = SessionNode(id="b", course_id=2, section_id=1, faculty_id=2,
                        requires_lab=False, requires_projector=True, capacity=30)
        g.add_node(a)
        g.add_node(b)
        g.add_edge("a", "b")
        assert "b" in g.neighbors("a")
        assert "a" in g.neighbors("b")
        assert g.degree("a") == 1

    def test_build_from_sessions(self):
        g = ConflictGraph()
        sessions = [
            SessionNode(id="1", course_id=1, section_id=1, faculty_id=1,
                        requires_lab=False, requires_projector=True, capacity=30),
            SessionNode(id="2", course_id=2, section_id=3, faculty_id=2,
                        requires_lab=False, requires_projector=True, capacity=30),
            SessionNode(id="3", course_id=1, section_id=2, faculty_id=1,
                        requires_lab=False, requires_projector=True, capacity=30),
        ]
        g.build_from_sessions(sessions)
        assert len(g) == 3
        # 1 and 3 share faculty 1 -> edge
        assert "3" in g.neighbors("1")
        # 1 and 2 share nothing -> no edge
        assert "2" not in g.neighbors("1")
        # 2 and 3 share nothing -> no edge
        assert "2" not in g.neighbors("3")

    def test_resource_conflict_detection(self):
        g = ConflictGraph()
        sessions = [
            SessionNode(id="1", course_id=1, section_id=1, faculty_id=1,
                        requires_lab=False, requires_projector=True, capacity=30),
            SessionNode(id="2", course_id=2, section_id=1, faculty_id=2,
                        requires_lab=False, requires_projector=True, capacity=30),
            SessionNode(id="3", course_id=3, section_id=2, faculty_id=1,
                        requires_lab=False, requires_projector=True, capacity=30),
        ]
        g.add_nodes(sessions)
        g.build_from_sessions(sessions)
        conflicts = g.detect_resource_conflict()
        # 1 & 3 conflict on faculty
        fac_conflicts = [c for c in conflicts if c[2] == "faculty"]
        assert len(fac_conflicts) >= 1
        # 1 & 2 conflict on section
        sec_conflicts = [c for c in conflicts if c[2] == "section"]
        assert len(sec_conflicts) >= 1


class TestDSATURColoring:
    """Tests for DSATUR graph coloring algorithm."""

    def test_empty_graph(self):
        g = ConflictGraph()
        res = dsatur(g, max_colors=5)
        assert res.valid()
        assert res.num_colors == 0

    def test_single_node(self):
        g = ConflictGraph()
        g.add_node(SessionNode(id="a", course_id=1, section_id=1, faculty_id=1,
                        requires_lab=False, requires_projector=True, capacity=30))
        res = dsatur(g, max_colors=5)
        assert res.valid()
        assert res.num_colors == 1
        assert res.coloring["a"] == 0

    def test_two_connected_nodes(self):
        g = ConflictGraph()
        a = SessionNode(id="a", course_id=1, section_id=1, faculty_id=1,
                        requires_lab=False, requires_projector=True, capacity=30)
        b = SessionNode(id="b", course_id=2, section_id=1, faculty_id=2,
                        requires_lab=False, requires_projector=True, capacity=30)
        g.add_node(a)
        g.add_node(b)
        g.add_edge("a", "b")
        res = dsatur(g, max_colors=5)
        assert res.valid()
        assert res.coloring["a"] != res.coloring["b"]
        assert res.num_colors == 2

    def test_complete_graph(self):
        """K_n needs n colors."""
        for n in [3, 4, 5]:
            g = ConflictGraph()
            nodes = [SessionNode(id=str(i), course_id=i, section_id=1,
                                 faculty_id=i, requires_lab=False,
                                 requires_projector=True, capacity=30)
                     for i in range(n)]
            g.add_nodes(nodes)
            for i in range(n):
                for j in range(i+1, n):
                    g.add_edge(str(i), str(j))
            res = dsatur(g, max_colors=n)
            assert res.valid(), f"Failed for K_{n}"
            assert res.num_colors == n, f"Expected {n} colors for K_{n}"

    def test_max_colors_exceeded(self):
        g = ConflictGraph()
        a = SessionNode(id="a", course_id=1, section_id=1, faculty_id=1,
                        requires_lab=False, requires_projector=True, capacity=30)
        b = SessionNode(id="b", course_id=2, section_id=2, faculty_id=2,
                        requires_lab=False, requires_projector=True, capacity=30)
        g.add_node(a)
        g.add_node(b)
        g.add_edge("a", "b")
        # Only 1 color allowed
        res = dsatur(g, max_colors=1)
        assert not res.valid()
        assert res.conflicts

    def test_time_slot_mapping(self):
        g = ConflictGraph()
        a = SessionNode(id="a", course_id=1, section_id=1, faculty_id=1,
                        requires_lab=False, requires_projector=True, capacity=30)
        b = SessionNode(id="b", course_id=2, section_id=2, faculty_id=2,
                        requires_lab=False, requires_projector=True, capacity=30)
        g.add_node(a)
        g.add_node(b)
        g.add_edge("a", "b")
        res = dsatur(g, max_colors=5)
        ts = [TimeSlot(id=101, day_of_week=0, start_time=time(8,0), end_time=time(9,0)),
              TimeSlot(id=102, day_of_week=0, start_time=time(9,0), end_time=time(10,0))]
        mapping = assign_time_slots(res, ts)
        assert mapping["a"] in (101, 102)
        assert mapping["b"] in (101, 102)
        assert mapping["a"] != mapping["b"]

    def test_greedy_coloring(self):
        g = ConflictGraph()
        for i in range(4):
            g.add_node(SessionNode(id=str(i), course_id=i, section_id=1,
                                   faculty_id=i, requires_lab=False,
                                   requires_projector=True, capacity=30))
        g.add_edge("0", "1")
        g.add_edge("1", "2")
        g.add_edge("2", "3")
        res = greedy_coloring(g, order="degree_desc")
        assert res.valid()
        # Path of length 3 is 2-colorable
        assert res.num_colors <= 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])