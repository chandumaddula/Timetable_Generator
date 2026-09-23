"""DSATUR graph coloring implementation with time-slot assignment."""
from __future__ import annotations
from typing import Dict, List, Set, Optional, Tuple, Iterable
from dataclasses import dataclass, field
from app.algorithms.graph import ConflictGraph, SessionNode


@dataclass
class ColoringResult:
    coloring: Dict[str, int]          # node_id -> color index
    num_colors: int
    saturated: bool = True
    conflicts: List[Tuple[str, str]] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)

    def valid(self) -> bool:
        return self.saturated and not self.conflicts


def dsatur(graph: ConflictGraph, max_colors: Optional[int] = None, tie_breaker: str = "degree") -> ColoringResult:
    """
    DSATUR (Degree of Saturation) exact/graph-coloring heuristic.
    Returns a ColoringResult with mapping node_id -> color (int).
    """
    uncolored = set(graph.nodes.keys())
    color_of: Dict[str, int] = {}
    saturation: Dict[str, int] = {nid: 0 for nid in uncolored}
    # keep track of colors used by neighbors
    neighbor_colors: Dict[str, Set[int]] = {nid: set() for nid in uncolored}

    def max_color_used() -> int:
        return max(color_of.values()) if color_of else -1

    def saturation_of(node_id: str) -> int:
        return len(neighbor_colors[node_id])

    while uncolored:
        # pick vertex with highest saturation; tie-break by degree
        best = max(
            uncolored,
            key=lambda nid: (
                saturation_of(nid),
                graph.degree(nid) if tie_breaker == "degree" else 0
            )
        )

        # find smallest feasible color
        forbidden = neighbor_colors[best]
        color = 0
        while color in forbidden:
            color += 1
            if max_colors is not None and color >= max_colors:
                break

        if max_colors is not None and color >= max_colors:
            # cannot color with available palette
            # Record conflicts between the failed node and ALL its neighbors
            # (they all need distinct colors from each other and from this node)
            return ColoringResult(
                coloring=color_of,
                num_colors=max_colors,
                saturated=False,
                conflicts=[(best, n) for n in graph.neighbors(best)],
                metadata={"failed_node": best}
            )

        color_of[best] = color
        uncolored.remove(best)

        # update saturation of neighbors
        for nb in graph.neighbors(best):
            neighbor_colors[nb].add(color)
            # saturation is len of neighbor_colors[nb]

    return ColoringResult(
        coloring=color_of,
        num_colors=max_color_used() + 1,
        saturated=True,
        conflicts=[]
    )


def greedy_coloring(graph: ConflictGraph, order: str = "degree_desc") -> ColoringResult:
    """Simple greedy coloring with configurable vertex ordering."""
    nodes = list(graph.nodes.keys())
    if order == "degree_desc":
        nodes.sort(key=lambda n: graph.degree(n), reverse=True)
    elif order == "degree_asc":
        nodes.sort(key=lambda n: graph.degree(n))
    elif order == "random":
        import random
        random.shuffle(nodes)

    color_of: Dict[str, int] = {}
    for node_id in nodes:
        used = {color_of[nb] for nb in graph.neighbors(node_id) if nb in color_of}
        color = 0
        while color in used:
            color += 1
        color_of[node_id] = color

    return ColoringResult(
        coloring=color_of,
        num_colors=max(color_of.values()) + 1 if color_of else 0,
        saturated=True
    )


def assign_time_slots(
    coloring: ColoringResult,
    time_slots: List[TimeSlot],
    skip_breaks: bool = True,
) -> Dict[str, int]:
    """
    Map color indices to actual time-slot IDs.
    Returns dict node_id -> time_slot_id.

    The coloring is a conflict-coloring: nodes with the same color do not
    share faculty/section. To use the full palette of available time slots,
    we spread each color across the time-slot space in a round-robin way so
    that the resulting schedule uses all time slots, not just a few.
    """
    if not time_slots:
        return {}

    available_slots = [ts for ts in time_slots if not (skip_breaks and ts.is_break)]
    if not available_slots:
        available_slots = time_slots  # fallback

    slot_ids = [ts.id for ts in available_slots]
    # Group nodes by color
    by_color: Dict[int, List[str]] = {}
    for node_id, color in coloring.coloring.items():
        by_color.setdefault(color, []).append(node_id)

    mapping: Dict[str, int] = {}
    next_slot_offset = 0
    sorted_colors = sorted(by_color.keys())
    for color in sorted_colors:
        for node_id in by_color[color]:
            slot_idx = next_slot_offset % len(slot_ids)
            mapping[node_id] = slot_ids[slot_idx]
            next_slot_offset += 1
    return mapping


def assign_time_slots_with_availability(
    coloring: ColoringResult,
    time_slots: List[TimeSlot],
    sessions: List["SessionNode"],
    faculty_avail: List = None,
    skip_breaks: bool = True,
) -> Dict[str, int]:
    """
    Smarter time-slot mapping: avoids slots where the assigned faculty
    is explicitly unavailable.
    """
    if not time_slots:
        return {}

    available_slots = [ts for ts in time_slots if not (skip_breaks and ts.is_break)]
    if not available_slots:
        available_slots = time_slots

    faculty_avail = faculty_avail or []
    # Build a set of (faculty_id, time_slot_id) -> unavailable
    unavailable = {
        (a.faculty_id, a.time_slot_id) for a in faculty_avail if not a.is_available
    }

    # Build a map of session -> faculty
    session_faculty = {s.id: s.faculty_id for s in sessions}

    slot_ids = [ts.id for ts in available_slots]
    mapping: Dict[str, int] = {}

    # Group nodes by color
    by_color: Dict[int, List[str]] = {}
    for node_id, color in coloring.coloring.items():
        by_color.setdefault(color, []).append(node_id)

    for color, node_ids in by_color.items():
        # try each slot for this color, picking the first that satisfies
        # all sessions' faculty availability
        for offset in range(len(slot_ids)):
            slot_id = slot_ids[(color + offset) % len(slot_ids)]
            ok = True
            for node_id in node_ids:
                fac_id = session_faculty.get(node_id)
                if fac_id is not None and (fac_id, slot_id) in unavailable:
                    ok = False
                    break
            if ok:
                for node_id in node_ids:
                    mapping[node_id] = slot_id
                break
        else:
            # Could not find a fully-available slot; fall back to color%len
            slot_id = slot_ids[color % len(slot_ids)]
            for node_id in node_ids:
                mapping[node_id] = slot_id

    return mapping


# Need TimeSlot definition for typing - import from models
from app.models.base import TimeSlot  # noqa: E402