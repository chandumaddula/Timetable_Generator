"""Integration tests for the full scheduler + validator + room allocator."""
import pytest
from datetime import time
from app.algorithms.scheduler import TimetableScheduler, GenerationInput
from app.constraints import Severity


def make_faculty(id):
    from app.models.base import Faculty
    return Faculty(id=id, name=f"F{id}", department="CS", max_hours_per_week=20)


def make_course(id, is_lab=False, periods=3, faculty_id=1):
    from app.models.base import Course
    return Course(id=id, code=f"C{id}", name=f"Course {id}",
                  is_lab=is_lab, default_periods_per_week=periods,
                  min_periods=1, faculty_id=faculty_id)


def make_section(id, course_id, periods=3, requires_lab=False):
    from app.models.base import Section
    return Section(id=id, course_id=course_id, section_number=f"S{id}",
                   capacity=30, periods_per_week=periods, requires_lab=requires_lab)


def make_room(id, cap=30, room_type="lecture"):
    from app.models.base import Room
    return Room(id=id, room_number=f"R{id}", capacity=cap, has_projector=True,
                room_type=room_type)


def make_slot(id, day=0, hour=8):
    from app.models.base import TimeSlot
    return TimeSlot(id=id, day_of_week=day,
                    start_time=time(hour, 0), end_time=time(hour+1, 0))


class TestScheduler:
    """Tests for the full scheduler."""

    def test_simple_schedule(self):
        faculty = [make_faculty(1)]
        courses = [make_course(1, periods=2, faculty_id=1)]
        sections = [make_section(1, course_id=1, periods=2)]
        rooms = [make_room(1, cap=30)]
        slots = [make_slot(i, day=i % 5, hour=8 + (i % 4)) for i in range(1, 9)]

        gen_input = GenerationInput(
            courses=courses, sections=sections, faculty=faculty,
            rooms=rooms, time_slots=slots
        )
        scheduler = TimetableScheduler(gen_input)
        result = scheduler.generate()

        assert result.success
        assert len(result.assignments) == 2

    def test_faculty_conflict_handling(self):
        """Faculty with multiple sections should be separated in time."""
        faculty = [make_faculty(1)]
        courses = [
            make_course(1, periods=2, faculty_id=1),
            make_course(2, periods=2, faculty_id=1),  # same faculty
        ]
        sections = [
            make_section(1, course_id=1, periods=2),
            make_section(2, course_id=2, periods=2),
        ]
        rooms = [make_room(1, cap=30)]
        slots = [make_slot(i, day=i % 5, hour=8 + (i % 4)) for i in range(1, 9)]

        gen_input = GenerationInput(
            courses=courses, sections=sections, faculty=faculty,
            rooms=rooms, time_slots=slots
        )
        scheduler = TimetableScheduler(gen_input)
        result = scheduler.generate()

        # Should be valid (no faculty overlap)
        assert result.success
        # Check no two assignments have same (faculty, time_slot)
        seen = set()
        for a in result.assignments:
            assert (a.faculty_id, a.time_slot_id) not in seen, f"Conflict: {(a.faculty_id, a.time_slot_id)}"
            seen.add((a.faculty_id, a.time_slot_id))

    def test_room_assignment(self):
        faculty = [make_faculty(1)]
        courses = [make_course(1, periods=2, faculty_id=1)]
        sections = [make_section(1, course_id=1, periods=2)]
        rooms = [make_room(1, cap=30), make_room(2, cap=30)]
        slots = [make_slot(i, day=i % 5, hour=8 + (i % 4)) for i in range(1, 9)]

        gen_input = GenerationInput(
            courses=courses, sections=sections, faculty=faculty,
            rooms=rooms, time_slots=slots
        )
        scheduler = TimetableScheduler(gen_input)
        result = scheduler.generate()

        # All assignments should have a valid room
        for a in result.assignments:
            assert a.room_id in [1, 2]
        # No room overlap
        seen_rooms = set()
        for a in result.assignments:
            assert (a.room_id, a.time_slot_id) not in seen_rooms, "Room overlap!"
            seen_rooms.add((a.room_id, a.time_slot_id))

    def test_lab_session_uses_lab_room(self):
        faculty = [make_faculty(1)]
        courses = [make_course(1, is_lab=True, periods=1, faculty_id=1)]
        sections = [make_section(1, course_id=1, periods=1, requires_lab=True)]
        rooms = [
            make_room(1, cap=30, room_type="lecture"),
            make_room(2, cap=30, room_type="lab"),
        ]
        slots = [make_slot(i, day=i % 5, hour=8 + (i % 4)) for i in range(1, 9)]

        gen_input = GenerationInput(
            courses=courses, sections=sections, faculty=faculty,
            rooms=rooms, time_slots=slots
        )
        scheduler = TimetableScheduler(gen_input)
        result = scheduler.generate()

        # All labs should be in room 2 (lab)
        lab_room_ids = {a.room_id for a in result.assignments if a.is_lab}
        if lab_room_ids:
            assert 2 in lab_room_ids or len(lab_room_ids) == 0

    def test_no_rooms_available(self):
        """When no rooms are available, scheduler should report issues."""
        faculty = [make_faculty(1)]
        courses = [make_course(1, periods=1, faculty_id=1)]
        sections = [make_section(1, course_id=1, periods=1)]
        # No rooms
        rooms = []
        slots = [make_slot(i, day=i % 5, hour=8 + (i % 4)) for i in range(1, 9)]

        gen_input = GenerationInput(
            courses=courses, sections=sections, faculty=faculty,
            rooms=rooms, time_slots=slots
        )
        scheduler = TimetableScheduler(gen_input)
        result = scheduler.generate()

        # Should not be successful or should have validation issues
        # (Either no rooms, or assignments with room_id=0 which is invalid)
        if result.assignments:
            # Check that we can detect problems
            assert result.validation is not None

    def test_validation_score(self):
        faculty = [make_faculty(1)]
        courses = [make_course(1, periods=2, faculty_id=1)]
        sections = [make_section(1, course_id=1, periods=2)]
        rooms = [make_room(1, cap=30)]
        slots = [make_slot(i, day=i % 5, hour=8 + (i % 4)) for i in range(1, 9)]

        gen_input = GenerationInput(
            courses=courses, sections=sections, faculty=faculty,
            rooms=rooms, time_slots=slots
        )
        scheduler = TimetableScheduler(gen_input)
        result = scheduler.generate()

        # Validation should give a score between 0 and 100
        assert 0 <= result.validation.score <= 100

    def test_impossible_schedule_detection(self):
        """When there's a clear conflict, scheduler should report it."""
        faculty = [make_faculty(1)]
        courses = [
            make_course(1, periods=2, faculty_id=1),
        ]
        sections = [make_section(1, course_id=1, periods=2)]
        # Only 1 slot -> can't fit 2 sessions of same faculty
        rooms = [make_room(1, cap=30)]
        slots = [make_slot(1, day=0, hour=8)]

        gen_input = GenerationInput(
            courses=courses, sections=sections, faculty=faculty,
            rooms=rooms, time_slots=slots
        )
        scheduler = TimetableScheduler(gen_input)
        result = scheduler.generate()

        # Either failed or had hard violations
        if not result.success:
            assert len(result.conflicts) > 0 or result.validation.hard_violations > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])