"""Hard and soft constraints for timetable generation & validation."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
from enum import Enum
from app.models.base import (
    Faculty, Course, Section, Room, TimeSlot, FacultyAvailability,
    RoomAvailability, FacultyPreference
)


class Severity(str, Enum):
    HARD = "hard"
    SOFT = "soft"


@dataclass
class ConstraintViolation:
    severity: Severity
    code: str
    message: str
    involved_entities: Dict[str, int] = field(default_factory=dict)
    suggestion: Optional[str] = None

    def to_dict(self):
        return {
            "severity": self.severity.value,
            "code": self.code,
            "message": self.message,
            "entities": self.involved_entities,
            "suggestion": self.suggestion,
        }


@dataclass
class ScheduleAssignment:
    """A single assignment of (course, section) to (faculty, room, time-slot)."""
    course_id: int
    section_id: int
    faculty_id: int
    room_id: int
    time_slot_id: int
    entry_id: Optional[int] = None
    is_lab: bool = False
    requires_projector: bool = True
    capacity_required: int = 30


class ConstraintEngine:
    """Validates a list of ScheduleAssignment objects against hard/soft rules."""

    def __init__(
        self,
        faculty: List[Faculty],
        courses: List[Course],
        sections: List[Section],
        rooms: List[Room],
        time_slots: List[TimeSlot],
        faculty_avail: Optional[List[FacultyAvailability]] = None,
        room_avail: Optional[List[RoomAvailability]] = None,
        faculty_prefs: Optional[List[FacultyPreference]] = None,
    ):
        self.faculty_by_id = {f.id: f for f in faculty}
        self.courses_by_id = {c.id: c for c in courses}
        self.sections_by_id = {s.id: s for s in sections}
        self.rooms_by_id = {r.id: r for r in rooms}
        self.time_slots_by_id = {t.id: t for t in time_slots}
        self.faculty_avail = faculty_avail or []
        self.room_avail = room_avail or []
        self.faculty_prefs = faculty_prefs or []

    def validate(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        violations.extend(self._no_faculty_overlap(assignments))
        violations.extend(self._no_section_overlap(assignments))
        violations.extend(self._no_room_overlap(assignments))
        violations.extend(self._faculty_availability(assignments))
        violations.extend(self._room_availability(assignments))
        violations.extend(self._room_capacity(assignments))
        violations.extend(self._lab_requirements(assignments))
        violations.extend(self._no_break_assignment(assignments))
        violations.extend(self._required_periods(assignments))

        violations.extend(self._faculty_preferences(assignments))
        violations.extend(self._faculty_gaps(assignments))
        violations.extend(self._student_gaps(assignments))
        violations.extend(self._consecutive_classes(assignments))
        violations.extend(self._workload_balance(assignments))
        violations.extend(self._room_utilization(assignments))
        violations.extend(self._late_classes(assignments))
        return violations

    # ----- HARD constraints -----
    def _no_faculty_overlap(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        # group by (faculty, time_slot)
        by_key: Dict[Tuple[int, int], List[ScheduleAssignment]] = {}
        for a in assignments:
            by_key.setdefault((a.faculty_id, a.time_slot_id), []).append(a)
        for (f, t), group in by_key.items():
            if len(group) > 1:
                violations.append(ConstraintViolation(
                    severity=Severity.HARD,
                    code="faculty_overlap",
                    message=f"Faculty {f} is assigned to multiple sections at time slot {t}.",
                    involved_entities={"faculty_id": f, "time_slot_id": t},
                    suggestion="Move one of the conflicting sessions to a different time slot."
                ))
        return violations

    def _no_section_overlap(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        by_key: Dict[Tuple[int, int], List[ScheduleAssignment]] = {}
        for a in assignments:
            by_key.setdefault((a.section_id, a.time_slot_id), []).append(a)
        for (s, t), group in by_key.items():
            if len(group) > 1:
                violations.append(ConstraintViolation(
                    severity=Severity.HARD,
                    code="section_overlap",
                    message=f"Section {s} has multiple classes at time slot {t}.",
                    involved_entities={"section_id": s, "time_slot_id": t},
                    suggestion="A section cannot be in two places at the same time. Move or merge sessions."
                ))
        return violations

    def _no_room_overlap(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        by_key: Dict[Tuple[int, int], List[ScheduleAssignment]] = {}
        for a in assignments:
            by_key.setdefault((a.room_id, a.time_slot_id), []).append(a)
        for (r, t), group in by_key.items():
            if len(group) > 1:
                violations.append(ConstraintViolation(
                    severity=Severity.HARD,
                    code="room_overlap",
                    message=f"Room {r} has multiple classes at time slot {t}.",
                    involved_entities={"room_id": r, "time_slot_id": t},
                    suggestion="Move one of the classes to a different room or time slot."
                ))
        return violations

    def _faculty_availability(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        # explicit unavailability records
        unavailable: Set[Tuple[int, int]] = {
            (a.faculty_id, a.time_slot_id) for a in self.faculty_avail if not a.is_available
        }
        for a in assignments:
            if (a.faculty_id, a.time_slot_id) in unavailable:
                violations.append(ConstraintViolation(
                    severity=Severity.HARD,
                    code="faculty_unavailable",
                    message=f"Faculty {a.faculty_id} is marked unavailable at time slot {a.time_slot_id}.",
                    involved_entities={"faculty_id": a.faculty_id, "time_slot_id": a.time_slot_id},
                    suggestion="Choose a different time slot or update availability."
                ))
        return violations

    def _room_availability(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        unavailable: Set[Tuple[int, int]] = {
            (a.room_id, a.time_slot_id) for a in self.room_avail if not a.is_available
        }
        for a in assignments:
            if (a.room_id, a.time_slot_id) in unavailable:
                violations.append(ConstraintViolation(
                    severity=Severity.HARD,
                    code="room_unavailable",
                    message=f"Room {a.room_id} is marked unavailable at time slot {a.time_slot_id}.",
                    involved_entities={"room_id": a.room_id, "time_slot_id": a.time_slot_id},
                ))
        return violations

    def _room_capacity(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        for a in assignments:
            room = self.rooms_by_id.get(a.room_id)
            if room and a.capacity_required > room.capacity:
                violations.append(ConstraintViolation(
                    severity=Severity.HARD,
                    code="room_capacity",
                    message=f"Room {room.room_number} capacity {room.capacity} < required {a.capacity_required}.",
                    involved_entities={"room_id": a.room_id, "section_id": a.section_id},
                    suggestion="Use a larger room or split the section."
                ))
        return violations

    def _lab_requirements(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        for a in assignments:
            if a.is_lab:
                room = self.rooms_by_id.get(a.room_id)
                if room and room.room_type != "lab":
                    violations.append(ConstraintViolation(
                        severity=Severity.HARD,
                        code="lab_required",
                        message=f"Lab session {a.course_id} assigned to non-lab room {room.room_number}.",
                        involved_entities={"course_id": a.course_id, "room_id": a.room_id},
                        suggestion="Use a room with room_type='lab'."
                    ))
        return violations

    def _no_break_assignment(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        for a in assignments:
            ts = self.time_slots_by_id.get(a.time_slot_id)
            if ts and ts.is_break:
                violations.append(ConstraintViolation(
                    severity=Severity.HARD,
                    code="break_slot",
                    message=f"Class assigned to a break slot {ts.label or ts.id}.",
                    involved_entities={"time_slot_id": a.time_slot_id},
                ))
        return violations

    def _required_periods(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        """Each section should have at least min_periods for each course."""
        violations: List[ConstraintViolation] = []
        by_section_course: Dict[Tuple[int, int], int] = {}
        for a in assignments:
            key = (a.section_id, a.course_id)
            by_section_course[key] = by_section_course.get(key, 0) + 1
        for (section_id, course_id), count in by_section_course.items():
            course = self.courses_by_id.get(course_id)
            section = self.sections_by_id.get(section_id)
            min_required = (course.min_periods or 1) if course else 1
            target = section.periods_per_week if section else min_required
            if count < min_required:
                violations.append(ConstraintViolation(
                    severity=Severity.HARD,
                    code="under_target_periods",
                    message=f"Course {course.code if course else course_id} has only {count} sessions for section {section.section_number if section else section_id}, minimum required {min_required}.",
                    involved_entities={"section_id": section_id, "course_id": course_id},
                    suggestion="Add more sessions for this course or reduce min_periods."
                ))
        return violations

    # ----- SOFT constraints -----
    def _faculty_preferences(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        pref_by_faculty: Dict[int, List[FacultyPreference]] = {}
        for p in self.faculty_prefs:
            pref_by_faculty.setdefault(p.faculty_id, []).append(p)

        for a in assignments:
            prefs = pref_by_faculty.get(a.faculty_id, [])
            for pref in prefs:
                # simple textual preference match
                if pref.preference_type == "no_late" and a.time_slot_id:
                    ts = self.time_slots_by_id.get(a.time_slot_id)
                    if ts and ts.start_time and ts.start_time.hour >= 16:
                        violations.append(ConstraintViolation(
                            severity=Severity.SOFT,
                            code="faculty_late",
                            message=f"Faculty {a.faculty_id} prefers not to have late classes.",
                            involved_entities={"faculty_id": a.faculty_id, "time_slot_id": a.time_slot_id},
                        ))
                elif pref.preference_type == "no_early" and a.time_slot_id:
                    ts = self.time_slots_by_id.get(a.time_slot_id)
                    if ts and ts.start_time and ts.start_time.hour < 9:
                        violations.append(ConstraintViolation(
                            severity=Severity.SOFT,
                            code="faculty_early",
                            message=f"Faculty {a.faculty_id} prefers not to have early classes.",
                            involved_entities={"faculty_id": a.faculty_id, "time_slot_id": a.time_slot_id},
                        ))
        return violations

    def _faculty_gaps(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        """Faculty should not have idle gaps between classes on the same day."""
        violations: List[ConstraintViolation] = []
        by_faculty_day: Dict[Tuple[int, int], List[ScheduleAssignment]] = {}
        for a in assignments:
            ts = self.time_slots_by_id.get(a.time_slot_id)
            if not ts:
                continue
            by_faculty_day.setdefault((a.faculty_id, ts.day_of_week), []).append(a)
        for (f, d), group in by_faculty_day.items():
            if len(group) < 2:
                continue
            slots = sorted([self.time_slots_by_id[a.time_slot_id] for a in group], key=lambda s: s.start_time)
            for i in range(len(slots) - 1):
                # gap = end of current vs start of next
                if slots[i].end_time < slots[i + 1].start_time:
                    violations.append(ConstraintViolation(
                        severity=Severity.SOFT,
                        code="faculty_gap",
                        message=f"Faculty {f} has a gap on day {d} between {slots[i].end_time} and {slots[i+1].start_time}.",
                        involved_entities={"faculty_id": f, "day_of_week": d},
                    ))
                    break
        return violations

    def _student_gaps(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        """Students in a section should not have idle gaps between classes."""
        violations: List[ConstraintViolation] = []
        by_section_day: Dict[Tuple[int, int], List[ScheduleAssignment]] = {}
        for a in assignments:
            ts = self.time_slots_by_id.get(a.time_slot_id)
            if not ts:
                continue
            by_section_day.setdefault((a.section_id, ts.day_of_week), []).append(a)
        for (s, d), group in by_section_day.items():
            if len(group) < 2:
                continue
            slots = sorted([self.time_slots_by_id[a.time_slot_id] for a in group], key=lambda s: s.start_time)
            for i in range(len(slots) - 1):
                if slots[i].end_time < slots[i + 1].start_time:
                    violations.append(ConstraintViolation(
                        severity=Severity.SOFT,
                        code="student_gap",
                        message=f"Section {s} has a gap on day {d}.",
                        involved_entities={"section_id": s, "day_of_week": d},
                    ))
                    break
        return violations

    def _consecutive_classes(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        """Same course taught in back-to-back periods for the same section is a soft preference."""
        violations: List[ConstraintViolation] = []
        by_section_course: Dict[Tuple[int, int], List[ScheduleAssignment]] = {}
        for a in assignments:
            by_section_course.setdefault((a.section_id, a.course_id), []).append(a)
        for (s, c), group in by_section_course.items():
            if len(group) < 2:
                continue
            slots = sorted([self.time_slots_by_id[a.time_slot_id] for a in group if a.time_slot_id in self.time_slots_by_id],
                           key=lambda x: x.start_time)
            has_consec = False
            for i in range(len(slots) - 1):
                if slots[i].end_time == slots[i + 1].start_time:
                    has_consec = True
                    break
            if not has_consec and len(slots) > 1:
                violations.append(ConstraintViolation(
                    severity=Severity.SOFT,
                    code="consecutive_missing",
                    message=f"Course {c} in section {s} has no back-to-back periods.",
                    involved_entities={"course_id": c, "section_id": s},
                ))
        return violations

    def _workload_balance(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        """Faculty weekly teaching load should be balanced."""
        violations: List[ConstraintViolation] = []
        workload: Dict[int, int] = {}
        for a in assignments:
            workload[a.faculty_id] = workload.get(a.faculty_id, 0) + 1
        if not workload:
            return violations
        avg = sum(workload.values()) / len(workload)
        for f, load in workload.items():
            fac = self.faculty_by_id.get(f)
            cap = (fac.max_hours_per_week or 20) if fac else 20
            if load > cap:
                violations.append(ConstraintViolation(
                    severity=Severity.SOFT,
                    code="workload_exceeded",
                    message=f"Faculty {f} scheduled {load} periods, exceeds max {cap}.",
                    involved_entities={"faculty_id": f},
                ))
            elif abs(load - avg) > 3:
                violations.append(ConstraintViolation(
                    severity=Severity.SOFT,
                    code="workload_imbalance",
                    message=f"Faculty {f} load {load} is far from average {avg:.1f}.",
                    involved_entities={"faculty_id": f},
                ))
        return violations

    def _room_utilization(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        """Warn if a very small room is used for a large section (suboptimal)."""
        violations: List[ConstraintViolation] = []
        for a in assignments:
            room = self.rooms_by_id.get(a.room_id)
            if room and a.capacity_required and room.capacity > 2 * a.capacity_required:
                violations.append(ConstraintViolation(
                    severity=Severity.SOFT,
                    code="room_underutilized",
                    message=f"Room {room.room_number} (cap {room.capacity}) is much larger than required ({a.capacity_required}).",
                    involved_entities={"room_id": a.room_id, "section_id": a.section_id},
                ))
        return violations

    def _late_classes(self, assignments: List[ScheduleAssignment]) -> List[ConstraintViolation]:
        """Warn if a class is scheduled in late hours (after 17:00)."""
        violations: List[ConstraintViolation] = []
        for a in assignments:
            ts = self.time_slots_by_id.get(a.time_slot_id)
            if ts and ts.start_time and ts.start_time.hour >= 17:
                violations.append(ConstraintViolation(
                    severity=Severity.SOFT,
                    code="late_class",
                    message=f"Late class scheduled at {ts.start_time}.",
                    involved_entities={"time_slot_id": a.time_slot_id},
                ))
        return violations
