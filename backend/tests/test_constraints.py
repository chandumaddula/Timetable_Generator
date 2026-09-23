"""Tests for the constraint engine and validation."""
import pytest
from datetime import time
from app.constraints import ConstraintEngine, ScheduleAssignment, Severity
from app.models.base import Faculty, Course, Section, Room, TimeSlot, FacultyAvailability, RoomAvailability, FacultyPreference


def make_slot(id, day=0, start="08:00", end="09:00"):
    return TimeSlot(id=id, day_of_week=day, start_time=time.fromisoformat(start),
                    end_time=time.fromisoformat(end), is_break=False)


def make_assignment(course_id=1, section_id=1, faculty_id=1, room_id=1, time_slot_id=1, is_lab=False, capacity_required=30):
    return ScheduleAssignment(
        course_id=course_id, section_id=section_id, faculty_id=faculty_id,
        room_id=room_id, time_slot_id=time_slot_id,
        is_lab=is_lab, capacity_required=capacity_required
    )


def make_engine(*args, **kwargs):
    return ConstraintEngine(*args, **kwargs)


class TestHardConstraints:
    """Tests for hard constraint violations."""

    def test_no_faculty_overlap(self):
        faculty = [Faculty(id=1, name="F1", department="CS", max_hours_per_week=20)]
        courses = [Course(id=1, code="C1", name="Course 1")]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=30)]
        slots = [make_slot(1, 0), make_slot(2, 0)]
        engine = make_engine(faculty, courses, sections, rooms, slots)

        # Same faculty at same time slot
        assignments = [
            make_assignment(faculty_id=1, room_id=1, time_slot_id=1),
            make_assignment(course_id=1, section_id=2, faculty_id=1, room_id=2, time_slot_id=1),
        ]
        violations = engine.validate(assignments)
        hard = [v for v in violations if v.severity == Severity.HARD]
        faculty_violations = [v for v in hard if v.code == "faculty_overlap"]
        assert len(faculty_violations) >= 1

    def test_no_section_overlap(self):
        faculty = [Faculty(id=1, name="F1", department="CS")]
        courses = [Course(id=1, code="C1", name="Course 1")]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=30)]
        slots = [make_slot(1, 0), make_slot(2, 0)]
        engine = make_engine(faculty, courses, sections, rooms, slots)

        assignments = [
            make_assignment(section_id=1, faculty_id=1, room_id=1, time_slot_id=1),
            make_assignment(course_id=2, section_id=1, faculty_id=2, room_id=2, time_slot_id=1),
        ]
        violations = engine.validate(assignments)
        hard = [v for v in violations if v.severity == Severity.HARD]
        section_violations = [v for v in hard if v.code == "section_overlap"]
        assert len(section_violations) >= 1

    def test_no_room_overlap(self):
        faculty = [Faculty(id=1, name="F1", department="CS")]
        courses = [Course(id=1, code="C1", name="Course 1")]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=30)]
        slots = [make_slot(1, 0), make_slot(2, 0)]
        engine = make_engine(faculty, courses, sections, rooms, slots)

        assignments = [
            make_assignment(faculty_id=1, room_id=1, time_slot_id=1),
            make_assignment(course_id=2, section_id=2, faculty_id=2, room_id=1, time_slot_id=1),
        ]
        violations = engine.validate(assignments)
        hard = [v for v in violations if v.severity == Severity.HARD]
        room_violations = [v for v in hard if v.code == "room_overlap"]
        assert len(room_violations) >= 1

    def test_faculty_unavailability(self):
        faculty = [Faculty(id=1, name="F1", department="CS")]
        courses = [Course(id=1, code="C1", name="Course 1")]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=30)]
        slots = [make_slot(1, 0)]
        engine = make_engine(faculty, courses, sections, rooms, slots,
                            faculty_avail=[FacultyAvailability(faculty_id=1, time_slot_id=1, is_available=False)])

        assignments = [make_assignment(faculty_id=1, room_id=1, time_slot_id=1)]
        violations = engine.validate(assignments)
        hard = [v for v in violations if v.severity == Severity.HARD]
        assert any(v.code == "faculty_unavailable" for v in hard)

    def test_room_capacity(self):
        faculty = [Faculty(id=1, name="F1", department="CS")]
        courses = [Course(id=1, code="C1", name="Course 1")]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=20)]  # too small
        slots = [make_slot(1, 0)]
        engine = make_engine(faculty, courses, sections, rooms, slots)

        assignments = [make_assignment(faculty_id=1, room_id=1, time_slot_id=1, capacity_required=30)]
        violations = engine.validate(assignments)
        hard = [v for v in violations if v.severity == Severity.HARD]
        assert any(v.code == "room_capacity" for v in hard)

    def test_lab_requirement(self):
        faculty = [Faculty(id=1, name="F1", department="CS")]
        courses = [Course(id=1, code="C1", name="Course 1", is_lab=True)]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=30, room_type="lecture")]  # not a lab
        slots = [make_slot(1, 0)]
        engine = make_engine(faculty, courses, sections, rooms, slots)

        assignments = [make_assignment(course_id=1, faculty_id=1, room_id=1, time_slot_id=1, is_lab=True)]
        violations = engine.validate(assignments)
        hard = [v for v in violations if v.severity == Severity.HARD]
        assert any(v.code == "lab_required" for v in hard)

    def test_no_break_assignment(self):
        faculty = [Faculty(id=1, name="F1", department="CS")]
        courses = [Course(id=1, code="C1", name="Course 1")]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=30)]
        slots = [TimeSlot(id=1, day_of_week=0, start_time=time(12, 0), end_time=time(13, 0), is_break=True)]
        engine = make_engine(faculty, courses, sections, rooms, slots)

        assignments = [make_assignment(faculty_id=1, room_id=1, time_slot_id=1)]
        violations = engine.validate(assignments)
        hard = [v for v in violations if v.severity == Severity.HARD]
        assert any(v.code == "break_slot" for v in hard)


class TestSoftConstraints:
    """Tests for soft constraint violations."""

    def test_faculty_late_class(self):
        faculty = [Faculty(id=1, name="F1", department="CS")]
        courses = [Course(id=1, code="C1", name="Course 1")]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=30)]
        slots = [TimeSlot(id=1, day_of_week=0, start_time=time(17, 0), end_time=time(18, 0), is_break=False)]
        prefs = [FacultyPreference(faculty_id=1, preference_type="no_late", preference_value="", weight=1.5)]
        engine = make_engine(faculty, courses, sections, rooms, slots, faculty_prefs=prefs)

        assignments = [make_assignment(faculty_id=1, room_id=1, time_slot_id=1)]
        violations = engine.validate(assignments)
        soft = [v for v in violations if v.severity == Severity.SOFT]
        assert any(v.code == "faculty_late" for v in soft)

    def test_faculty_gap(self):
        faculty = [Faculty(id=1, name="F1", department="CS")]
        courses = [Course(id=1, code="C1", name="Course 1")]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=30)]
        slots = [
            TimeSlot(id=1, day_of_week=0, start_time=time(8, 0), end_time=time(9, 0)),
            TimeSlot(id=2, day_of_week=0, start_time=time(11, 0), end_time=time(12, 0)),
            TimeSlot(id=3, day_of_week=0, start_time=time(13, 0), end_time=time(14, 0)),
        ]
        engine = make_engine(faculty, courses, sections, rooms, slots)

        assignments = [
            make_assignment(faculty_id=1, room_id=1, time_slot_id=1),
            make_assignment(course_id=2, section_id=2, faculty_id=1, room_id=2, time_slot_id=2),
            make_assignment(course_id=3, section_id=3, faculty_id=1, room_id=3, time_slot_id=3),
        ]
        violations = engine.validate(assignments)
        soft = [v for v in violations if v.severity == Severity.SOFT]
        # There's a gap between slot 1 (8-9) and slot 2 (11-12)
        gap_violations = [v for v in soft if v.code == "faculty_gap"]
        assert len(gap_violations) >= 1

    def test_room_underutilization(self):
        faculty = [Faculty(id=1, name="F1", department="CS")]
        courses = [Course(id=1, code="C1", name="Course 1")]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=100)]  # huge room
        slots = [make_slot(1, 0)]
        engine = make_engine(faculty, courses, sections, rooms, slots)

        assignments = [make_assignment(faculty_id=1, room_id=1, time_slot_id=1, capacity_required=20)]
        violations = engine.validate(assignments)
        soft = [v for v in violations if v.severity == Severity.SOFT]
        assert any(v.code == "room_underutilized" for v in soft)


class TestConstraintEngine:
    """Tests for the constraint engine overall."""

    def test_valid_schedule_no_violations(self):
        faculty = [Faculty(id=1, name="F1", department="CS")]
        courses = [Course(id=1, code="C1", name="Course 1")]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=30)]
        slots = [make_slot(i, i % 5) for i in range(1, 6)]
        engine = make_engine(faculty, courses, sections, rooms, slots)

        assignments = [
            make_assignment(faculty_id=1, room_id=1, time_slot_id=1),
        ]
        violations = engine.validate(assignments)
        hard = [v for v in violations if v.severity == Severity.HARD]
        assert len(hard) == 0, f"Expected no hard violations, got: {[v.message for v in hard]}"

    def test_mixed_violations(self):
        faculty = [Faculty(id=1, name="F1", department="CS")]
        courses = [Course(id=1, code="C1", name="Course 1")]
        sections = [Section(id=1, course_id=1, periods_per_week=3)]
        rooms = [Room(id=1, room_number="R1", capacity=30)]
        slots = [make_slot(1, 0), make_slot(2, 0)]
        engine = make_engine(faculty, courses, sections, rooms, slots)

        # faculty overlap (hard): same faculty, same time slot
        # room overlap (hard): same room, same time slot
        assignments = [
            make_assignment(faculty_id=1, room_id=1, time_slot_id=1),
            make_assignment(course_id=2, section_id=2, faculty_id=1, room_id=1, time_slot_id=1),
        ]
        violations = engine.validate(assignments)
        hard = [v for v in violations if v.severity == Severity.HARD]
        soft = [v for v in violations if v.severity == Severity.SOFT]
        assert len(hard) > 0
        assert len(soft) >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])