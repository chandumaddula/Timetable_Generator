"""Conflict graph used for graph-coloring based timetable generation.

Each course-session (= a single scheduled class instance) is a node.
An edge between two nodes means those sessions CANNOT be placed in
the same time slot (because they conflict on faculty, section, room, etc.).
The chromatic number of this graph equals the minimum number of
time slots needed; DSATUR is used to color the graph in practice.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple, Iterable, Optional
import uuid


@dataclass
class SessionNode:
    """Represents a single scheduled class for a (course, section)."""
    id: str
    course_id: int
    section_id: int
    faculty_id: int
    requires_lab: bool
    requires_projector: bool
    capacity: int
    is_primary: bool = True
    label: str = ""
    # bookkeeping
    color: Optional[int] = None  # assigned time-slot index
    room_id: Optional[int] = None
    neighbor_ids: Set[str] = field(default_factory=set)

    def __hash__(self):
        return hash(self.id)


class ConflictGraph:
    """Adjacency list representation of the timetable conflict graph."""

    def __init__(self):
        self.nodes: Dict[str, SessionNode] = {}
        # adjacency: node_id -> set of node_ids
        self.edges: Dict[str, Set[str]] = {}

    # -- Node ops --
    def add_node(self, node: SessionNode) -> None:
        self.nodes[node.id] = node
        self.edges.setdefault(node.id, set())

    def add_nodes(self, nodes: Iterable[SessionNode]) -> None:
        for n in nodes:
            self.add_node(n)

    def remove_node(self, node_id: str) -> None:
        if node_id not in self.nodes:
            return
        for neigh in list(self.edges[node_id]):
            self.edges[neigh].discard(node_id)
        self.edges.pop(node_id, None)
        self.nodes.pop(node_id, None)

    # -- Edge ops --
    def add_edge(self, a: str, b: str) -> None:
        if a == b or a not in self.nodes or b not in self.nodes:
            return
        self.edges[a].add(b)
        self.edges[b].add(a)
        self.nodes[a].neighbor_ids.add(b)
        self.nodes[b].neighbor_ids.add(a)

    def add_conflicts(self, node_id: str, other_ids: Iterable[str]) -> None:
        for o in other_ids:
            if o == node_id:
                continue
            if o in self.nodes:
                self.add_edge(node_id, o)

    def neighbors(self, node_id: str) -> Set[str]:
        return self.edges.get(node_id, set())

    def degree(self, node_id: str) -> int:
        return len(self.neighbors(node_id))

    # -- Build helpers --
    def detect_resource_conflict(self) -> List[Tuple[str, str, str]]:
        """Return list of (a, b, reason) for all detected pairwise conflicts
        based purely on resource sharing (faculty, section, room)."""
        nodes = list(self.nodes.values())
        result: List[Tuple[str, str, str]] = []
        for i, a in enumerate(nodes):
            for b in nodes[i + 1:]:
                reason = self._conflict_reason(a, b)
                if reason:
                    result.append((a.id, b.id, reason))
        return result

    @staticmethod
    def _conflict_reason(a: SessionNode, b: SessionNode) -> Optional[str]:
        if a.faculty_id == b.faculty_id:
            return "faculty"
        if a.section_id == b.section_id:
            return "section"
        # room overlap only matters if same room is forced; we will let the
        # allocator decide, so we don't conflict on room here unless a hint is set
        return None

    def build_from_sessions(self, sessions: List[SessionNode]) -> None:
        """Rebuild edges from a flat list of sessions, assuming default rules."""
        self.add_nodes(sessions)
        nodes = sessions
        for i, a in enumerate(nodes):
            for b in nodes[i + 1:]:
                if self._conflict_reason(a, b):
                    self.add_edge(a.id, b.id)

    # -- Statistics --
    def density(self) -> float:
        n = len(self.nodes)
        if n < 2:
            return 0.0
        max_edges = n * (n - 1) / 2
        edge_count = sum(len(v) for v in self.edges.values()) / 2
        return edge_count / max_edges if max_edges else 0.0

    def chromatic_lower_bound(self) -> int:
        """Lower bound on chromatic number: max degree + 1."""
        if not self.nodes:
            return 0
        return max(self.degree(n) for n in self.nodes) + 1

    def __len__(self) -> int:
        return len(self.nodes)

    def __contains__(self, node_id: str) -> bool:
        return node_id in self.nodes


def new_session_id() -> str:
    return f"ses_{uuid.uuid4().hex[:12]}"
