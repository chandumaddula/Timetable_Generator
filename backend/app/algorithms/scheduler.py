"""Main timetable generation engine: graph coloring + room allocation + optimization."""
from __future__ import annotations
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Iterable
from app.algorithms.graph import ConflictGraph, SessionNode, new_session_id
from app.algorithms.coloring import dsatur, ColoringResult
from app.constraints import ConstraintEngine, ScheduleAssignment, Severity, ConstraintViolation
from app.validators import TimetableValidator, ValidationResult
from app.models.base import (
    Faculty, Course, Section, Room, TimeSlot,
    FacultyAvailability, RoomAvailability, FacultyPreference
)


@dataclass
class GenerationInput:
    courses: List[Course]
    sections: List[Section]
    faculty: List[Faculty]
    rooms: List[Room]
    time_slots: List[TimeSlot]
    faculty_avail: List[FacultyAvailability] = field(default_factory=list)
    room_avail: List[RoomAvailability] = field(default_factory=list)
    faculty_prefs: List[FacultyPreference] = field(default_factory=list)
    section_filter: Optional[List[int]] = None
    room_filter: Optional[List[int]] = None
    faculty_filter: Optional[List[int]] = None
    optimize: bool = True
    max_iterations: int = 100


@dataclass
class GenerationResult:
    assignments: List[ScheduleAssignment]
    coloring: ColoringResult
    validation: ValidationResult
    time_slot_map: Dict[str, int]  # session_id -> time_slot_id
    room_map: Dict[str, int]       # session_id -> room_id
    conflicts: List[Dict] = field(default_factory=list)
    success: bool = True
    message: str = ""


class TimetableScheduler:
    """High-level generator that produces a feasible timetable or reports conflicts."""

    def __init__(self, input_data: GenerationInput):
        self.input = input_data
        self.engine = ConstraintEngine(
            faculty=input_data.faculty,
            courses=input_data.courses,
            sections=input_data.sections,
            rooms=input_data.rooms,
            time_slots=input_data.time_slots,
            faculty_avail=input_data.faculty_avail,
            room_avail=input_data.room_avail,
            faculty_prefs=input_data.faculty_prefs,
        )
        self.validator = TimetableValidator(self.engine)

        # Filter entities if specified
        self.sections = self._filter(input_data.sections, input_data.section_filter)
        self.rooms = self._filter(input_data.rooms, input_data.room_filter)
        self.faculty = self._filter(input_data.faculty, input_data.faculty_filter)
        self.faculty_by_id = {f.id: f for f in self.faculty}
        self.course_by_id = {c.id: c for c in input_data.courses}
        self.room_by_id = {r.id: r for r in self.rooms}
        self.ts_by_id = {t.id: t for t in input_data.time_slots}

    @staticmethod
    def _filter(items, filter_ids):
        if not filter_ids:
            return items
        return [i for i in items if i.id in filter_ids]

    def generate(self) -> GenerationResult:
        # 1. Expand course-section pairs into sessions
        sessions = self._expand_sessions()

        if not sessions:
            return GenerationResult(
                assignments=[], coloring=ColoringResult({}, 0),
                validation=ValidationResult(True, 100.0, 0, 0, [], {}),
                time_slot_map={}, room_map={},
                success=False, message="No sessions to schedule."
            )

        # 2. Build conflict graph
        graph = self._build_conflict_graph(sessions)

        # 3. Graph coloring (DSATUR) with time slots as colors
        max_colors = len([t for t in self.input.time_slots if not t.is_break])
        coloring = dsatur(graph, max_colors=max_colors)

        if not coloring.valid():
            return self._handle_coloring_failure(sessions, graph, coloring, max_colors)

        # 4. Map colors to actual time slot IDs
        time_slot_map = self._assign_time_slots(sessions, coloring)

        # 5. Assign rooms to each session
        room_map = self._assign_rooms(sessions, time_slot_map)

        # 6. Build ScheduleAssignment list
        assignments = self._build_assignments(sessions, time_slot_map, room_map)

        # 7. Validate
        validation = self.validator.validate(assignments)

        # 8. Optimize soft constraints if requested
        if self.input.optimize and not validation.valid:
            assignments = self._local_search_optimize(assignments)
            validation = self.validator.validate(assignments)

        # 9. Final validation
        if validation.valid:
            return GenerationResult(
                assignments=assignments,
                coloring=coloring,
                validation=validation,
                time_slot_map=time_slot_map,
                room_map=room_map,
                success=True,
                message="Timetable generated successfully."
            )
        else:
            return GenerationResult(
                assignments=assignments,
                coloring=coloring,
                validation=validation,
                time_slot_map=time_slot_map,
                room_map=room_map,
                conflicts=[v.to_dict() for v in validation.violations],
                success=False,
                message="Timetable has hard violations. See conflicts for details."
            )

    # -- Step 1: Expand sessions --
    def _expand_sessions(self) -> List[SessionNode]:
        """Create SessionNode for each required class session."""
        sessions: List[SessionNode] = []

        for course in self.input.courses:
            course_sections = [s for s in self.sections if s.course_id == course.id]
            if not course_sections:
                continue

            for section in course_sections:
                faculty = self.faculty_by_id.get(course.faculty_id)
                if not faculty:
                    continue

                periods = section.periods_per_week
                for i in range(periods):
                    node = SessionNode(
                        id=new_session_id(),
                        course_id=course.id,
                        section_id=section.id,
                        faculty_id=faculty.id,
                        requires_lab=course.is_lab or section.requires_lab,
                        requires_projector=True,
                        capacity=section.capacity,
                        is_primary=(i == 0),
                        label=f"{course.code}-{section.section_number}-{i+1}"
                    )
                    sessions.append(node)
        return sessions

    # -- Step 2: Build conflict graph --
    def _build_conflict_graph(self, sessions: List[SessionNode]) -> ConflictGraph:
        graph = ConflictGraph()
        graph.add_nodes(sessions)

        # Build unavailable slot sets
        unavailable_slots: Set[int] = {
            a.time_slot_id for a in self.input.faculty_avail if not a.is_available
        }
        room_unavail: Set[int] = {
            a.time_slot_id for a in self.input.room_avail if not a.is_available
        }
        # For each faculty, track which time slots they are unavailable
        fac_unavail: Dict[int, Set[int]] = {}
        for a in self.input.faculty_avail:
            if not a.is_available:
                fac_unavail.setdefault(a.faculty_id, set()).add(a.time_slot_id)

        # Same faculty cannot teach at same time (base conflict)
        by_faculty: Dict[int, List[SessionNode]] = {}
        for s in sessions:
            by_faculty.setdefault(s.faculty_id, []).append(s)
        for fac_nodes in by_faculty.values():
            for i, a in enumerate(fac_nodes):
                for b in fac_nodes[i+1:]:
                    graph.add_edge(a.id, b.id)

        # Same section cannot have multiple classes at same time
        by_section: Dict[int, List[SessionNode]] = {}
        for s in sessions:
            by_section.setdefault(s.section_id, []).append(s)
        for sec_nodes in by_section.values():
            for i, a in enumerate(sec_nodes):
                for b in sec_nodes[i+1:]:
                    graph.add_edge(a.id, b.id)

        return graph

    # -- Step 3/4: Color handling --
    def _handle_coloring_failure(
        self,
        sessions: List[SessionNode],
        graph: ConflictGraph,
        coloring: ColoringResult,
        max_colors: int
    ) -> GenerationResult:
        """Analyze why coloring failed and return detailed conflict info."""
        # Try greedy as fallback
        greedy = dsatur(graph, max_colors=max_colors)
        if greedy.valid():
            # shouldn't happen if DSATUR failed but just in case
            pass

        # Build conflict report
        conflicts = []
        for a_id, b_id, reason in graph.detect_resource_conflict():
            a = graph.nodes[a_id]
            b = graph.nodes[b_id]
            conflicts.append({
                "type": reason,
                "session_a": {"id": a.id, "label": a.label, "course": a.course_id, "section": a.section_id, "faculty": a.faculty_id},
                "session_b": {"id": b.id, "label": b.label, "course": b.course_id, "section": b.section_id, "faculty": b.faculty_id},
                "message": f"Conflict ({reason}): {a.label} and {b.label} cannot share a time slot."
            })

        # Check if too many sessions for available slots
        if len(sessions) > max_colors * 2:  # rough heuristic
            conflicts.append({
                "type": "capacity",
                "message": f"Only {max_colors} non-break time slots available but {len(sessions)} sessions needed. Consider adding more time slots or reducing sessions."
            })

        return GenerationResult(
            assignments=[], coloring=coloring,
            validation=ValidationResult(False, 0.0, len(conflicts), 0, [], {}),
            time_slot_map={}, room_map={},
            conflicts=conflicts,
            success=False,
            message=f"Cannot schedule {len(sessions)} sessions into {max_colors} time slots without conflicts."
        )

    # -- Step 4b: Smart time-slot assignment with faculty availability awareness --
    def _assign_time_slots(
        self,
        sessions: List[SessionNode],
        coloring: ColoringResult,
    ) -> Dict[str, int]:
        """
        Map color indices to actual time-slot IDs, trying to avoid faculty
        unavailability and section/faculty conflicts that may arise from
        multiple sessions of the same section landing in the same slot.
        """
        available_slots = sorted(
            [ts for ts in self.input.time_slots if not ts.is_break],
            key=lambda ts: (ts.day_of_week, ts.start_time)
        )
        if not available_slots:
            available_slots = self.input.time_slots

        # Build unavailable (faculty, slot) set
        fac_unavail: Set[Tuple[int, int]] = {
            (a.faculty_id, a.time_slot_id)
            for a in self.input.faculty_avail
            if not a.is_available
        }

        # Group nodes by color
        by_color: Dict[int, List[SessionNode]] = {}
        for s in sessions:
            color = coloring.coloring.get(s.id, 0)
            by_color.setdefault(color, []).append(s)

        # Sort colors and sessions within each color for deterministic placement
        mapping: Dict[str, int] = {}

        # Track per-(faculty, slot) and per-(section, slot) usage as we assign
        fac_used: Set[Tuple[int, int]] = set()
        sec_used: Set[Tuple[int, int]] = set()

        for color in sorted(by_color.keys()):
            color_sessions = by_color[color]
            for s in color_sessions:
                assigned = False
                # Try each available slot starting from the color offset
                for offset in range(len(available_slots)):
                    ts = available_slots[(color + offset) % len(available_slots)]
                    # Avoid section double-booking
                    if (s.section_id, ts.id) in sec_used:
                        continue
                    # Avoid faculty double-booking
                    if (s.faculty_id, ts.id) in fac_used:
                        continue
                    # Avoid unavailable slots for this faculty
                    if (s.faculty_id, ts.id) in fac_unavail:
                        continue
                    mapping[s.id] = ts.id
                    sec_used.add((s.section_id, ts.id))
                    fac_used.add((s.faculty_id, ts.id))
                    assigned = True
                    break
                if not assigned:
                    # No available slot; pick the first non-conflicting slot
                    # (this should rarely happen if there are enough slots)
                    for ts in available_slots:
                        if (s.section_id, ts.id) in sec_used:
                            continue
                        if (s.faculty_id, ts.id) in fac_used:
                            continue
                        mapping[s.id] = ts.id
                        sec_used.add((s.section_id, ts.id))
                        fac_used.add((s.faculty_id, ts.id))
                        break
                    else:
                        # Worst case: assign to next available slot
                        mapping[s.id] = available_slots[color % len(available_slots)].id

        return mapping

    # -- Step 5: Room assignment --
    def _assign_rooms(self, sessions: List[SessionNode], time_slot_map: Dict[str, int]) -> Dict[str, int]:
        """Greedy room assignment per time slot.

        Labs are given priority for lab rooms; non-labs fill remaining rooms.
        """
        room_map: Dict[str, int] = {}

        # Group sessions by assigned time slot
        by_time_slot: Dict[int, List[SessionNode]] = {}
        for s in sessions:
            ts_id = time_slot_map.get(s.id)
            if ts_id:
                by_time_slot.setdefault(ts_id, []).append(s)

        # For each time slot, assign rooms
        for ts_id, slot_sessions in by_time_slot.items():
            # Sort sessions: labs first, then larger capacity
            slot_sessions.sort(key=lambda s: (not s.requires_lab, -s.capacity))

            # Track which rooms are used in this time slot
            used_rooms: Set[int] = set()

            for session in slot_sessions:
                best_room = self._find_best_room(session, ts_id, used_rooms)
                if best_room:
                    room_map[session.id] = best_room
                    used_rooms.add(best_room)
                else:
                    # Fallback: any available room (prefer unused ones)
                    for room in self.rooms:
                        if room.id not in used_rooms:
                            room_map[session.id] = room.id
                            used_rooms.add(room.id)
                            break
                    else:
                        # No available room found - still assign something to avoid None
                        if self.rooms:
                            room_map[session.id] = self.rooms[0].id

        return room_map

    def _find_best_room(self, session: SessionNode, time_slot_id: int, used_rooms: Set[int]) -> Optional[int]:
        """Find the best room for a session, with progressive relaxation.

        Priority:
        1. Best fit (exact or small overflow) with all hard constraints met
        2. Any unused room (relax capacity) - so the schedule can still complete
        """
        # Build unavailable rooms for this slot
        unavailable_rooms = {
            a.room_id for a in self.input.room_avail
            if a.time_slot_id == time_slot_id and not a.is_available
        }

        # First pass: strict - all constraints
        candidates = []
        for room in self.rooms:
            if room.id in used_rooms:
                continue
            if room.id in unavailable_rooms:
                continue
            if room.capacity < session.capacity:
                continue
            if session.requires_lab and room.room_type != "lab":
                continue
            if session.requires_projector and not room.has_projector:
                continue
            candidates.append(room)

        if candidates:
            # Prefer exact fit, then smallest suitable
            candidates.sort(key=lambda r: (r.capacity - session.capacity, r.capacity))
            return candidates[0].id

        # Second pass: relax lab/projector requirements
        for room in self.rooms:
            if room.id in used_rooms:
                continue
            if room.id in unavailable_rooms:
                continue
            if room.capacity < session.capacity:
                continue
            candidates.append(room)

        if candidates:
            candidates.sort(key=lambda r: (r.capacity - session.capacity, r.capacity))
            return candidates[0].id

        # Third pass: relax capacity (overflow)
        for room in self.rooms:
            if room.id in used_rooms:
                continue
            if room.id in unavailable_rooms:
                continue
            candidates.append(room)

        if candidates:
            # Pick the largest available (least overflow)
            candidates.sort(key=lambda r: -r.capacity)
            return candidates[0].id

        # Last resort: any unused room
        for room in self.rooms:
            if room.id not in used_rooms:
                return room.id

        return None

    # -- Step 6: Build assignments --
    def _build_assignments(
        self,
        sessions: List[SessionNode],
        time_slot_map: Dict[str, int],
        room_map: Dict[str, int]
    ) -> List[ScheduleAssignment]:
        assignments = []
        for s in sessions:
            assignments.append(ScheduleAssignment(
                course_id=s.course_id,
                section_id=s.section_id,
                faculty_id=s.faculty_id,
                room_id=room_map.get(s.id, 0),
                time_slot_id=time_slot_map.get(s.id, 0),
                is_lab=s.requires_lab,
                requires_projector=s.requires_projector,
                capacity_required=s.capacity,
            ))
        return assignments

    # -- Step 8: Local search optimization --
    def _local_search_optimize(
        self,
        assignments: List[ScheduleAssignment]
    ) -> List[ScheduleAssignment]:
        """Simple hill-climbing: try swapping time slots between two assignments.

        Only swaps that preserve hard constraints are accepted.
        """
        best = list(assignments)
        best_val = self.validator.validate(best)
        best_score = best_val.score

        non_break_slots = [t.id for t in self.input.time_slots if not t.is_break]
        if len(non_break_slots) < 2:
            return best

        # Build set of (faculty, slot) -> unavailable for quick lookup
        fac_unavail = {
            (a.faculty_id, a.time_slot_id) for a in self.input.faculty_avail if not a.is_available
        }

        no_improve_count = 0
        max_no_improve = 50
        for _ in range(self.input.max_iterations):
            # Randomly pick two assignments
            i, j = random.sample(range(len(best)), 2)
            a, b = best[i], best[j]

            # Skip if same section or faculty (would create hard conflict)
            if a.section_id == b.section_id or a.faculty_id == b.faculty_id:
                no_improve_count += 1
                if no_improve_count > max_no_improve:
                    break
                continue

            # Skip if either side becomes unavailable in the proposed slot
            if (a.faculty_id, b.time_slot_id) in fac_unavail or (b.faculty_id, a.time_slot_id) in fac_unavail:
                no_improve_count += 1
                if no_improve_count > max_no_improve:
                    break
                continue

            # Swap time slots
            orig_a_ts, orig_b_ts = a.time_slot_id, b.time_slot_id
            a.time_slot_id, b.time_slot_id = b.time_slot_id, a.time_slot_id

            val = self.validator.validate(best)
            if val.valid and val.score > best_score:
                best_score = val.score
                best_val = val
                no_improve_count = 0
            else:
                # Revert
                a.time_slot_id, b.time_slot_id = orig_a_ts, orig_b_ts
                no_improve_count += 1

            if no_improve_count > max_no_improve:
                break

        return best


def generate_timetable(
    courses: List[Course],
    sections: List[Section],
    faculty: List[Faculty],
    rooms: List[Room],
    time_slots: List[TimeSlot],
    faculty_avail: Optional[List[FacultyAvailability]] = None,
    room_avail: Optional[List[RoomAvailability]] = None,
    faculty_prefs: Optional[List[FacultyPreference]] = None,
    **kwargs
) -> GenerationResult:
    """Convenience function for quick generation."""
    inp = GenerationInput(
        courses=courses,
        sections=sections,
        faculty=faculty,
        rooms=rooms,
        time_slots=time_slots,
        faculty_avail=faculty_avail or [],
        room_avail=room_avail or [],
        faculty_prefs=faculty_prefs or [],
        **kwargs
    )
    scheduler = TimetableScheduler(inp)
    return scheduler.generate()