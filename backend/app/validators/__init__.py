"""Validation and scoring utilities for timetables."""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Tuple
from app.constraints import ConstraintEngine, ConstraintViolation, ScheduleAssignment, Severity


@dataclass
class ValidationResult:
    valid: bool
    score: float
    hard_violations: int
    soft_violations: int
    violations: List[ConstraintViolation]
    details: Dict

    def to_dict(self):
        return {
            "valid": self.valid,
            "score": self.score,
            "hard_violations": self.hard_violations,
            "soft_violations": self.soft_violations,
            "issues": [v.to_dict() for v in self.violations],
            "details": self.details,
        }


class TimetableValidator:
    """High-level validator that wraps ConstraintEngine and provides scoring."""

    def __init__(self, engine: ConstraintEngine):
        self.engine = engine

    def validate(self, assignments: List[ScheduleAssignment]) -> ValidationResult:
        violations = self.engine.validate(assignments)

        hard = sum(1 for v in violations if v.severity == Severity.HARD)
        soft = sum(1 for v in violations if v.severity == Severity.SOFT)

        # Scoring: 100 - hard*20 - soft*3 (clamped 0-100)
        score = max(0.0, 100.0 - hard * 20.0 - soft * 3.0)

        return ValidationResult(
            valid=(hard == 0),
            score=score,
            hard_violations=hard,
            soft_violations=soft,
            violations=violations,
            details={
                "total_assignments": len(assignments),
                "by_severity": {
                    "hard": hard,
                    "soft": soft,
                },
                "by_code": self._group_by_code(violations),
            }
        )

    @staticmethod
    def _group_by_code(violations: List[ConstraintViolation]) -> Dict[str, int]:
        result: Dict[str, int] = {}
        for v in violations:
            result[v.code] = result.get(v.code, 0) + 1
        return result


def assignments_from_timetable_entries(
    entries,
    courses, sections, rooms, time_slots, faculty
) -> List[ScheduleAssignment]:
    """Convert ORM TimetableEntry objects to ScheduleAssignment list."""
    course_by_id = {c.id: c for c in courses}
    section_by_id = {s.id: s for s in sections}
    room_by_id = {r.id: r for r in rooms}

    result = []
    for e in entries:
        course = course_by_id.get(e.course_id)
        section = section_by_id.get(e.section_id)
        room = room_by_id.get(e.room_id)
        result.append(ScheduleAssignment(
            course_id=e.course_id,
            section_id=e.section_id,
            faculty_id=e.faculty_id,
            room_id=e.room_id,
            time_slot_id=e.time_slot_id,
            entry_id=e.id,
            is_lab=(course.is_lab if course else e.entry_type == "lab"),
            requires_projector=room.has_projector if room else True,
            capacity_required=section.capacity if section else 30,
        ))
    return result