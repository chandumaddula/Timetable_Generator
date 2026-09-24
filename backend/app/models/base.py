from sqlalchemy import Column, Integer, DateTime, String, Boolean, Text, ForeignKey, Float, Time
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

def _now():
    return datetime.utcnow()

class TimestampMixin:
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

    roles = relationship("UserRole", back_populates="user")
    timetables = relationship("Timetable", back_populates="user")

class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(Text)

    user_roles = relationship("UserRole", back_populates="role")

class UserRole(Base, TimestampMixin):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    role_id = Column(Integer, ForeignKey("roles.id"))

    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="user_roles")

class Department(Base, TimestampMixin):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    code = Column(String(20), unique=True, index=True, nullable=True)
    description = Column(Text, nullable=True)

    courses = relationship("Course", back_populates="department")
    faculty = relationship("Faculty", back_populates="department_rel")
    rooms = relationship("Room", back_populates="department_rel")

class Faculty(Base, TimestampMixin):
    __tablename__ = "faculty"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    initials = Column(String(20), nullable=True)
    department = Column(String(100))  # String name preserved for backwards compatibility
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    email = Column(String(255))
    is_full_time = Column(Boolean, default=True)
    max_hours_per_week = Column(Integer, default=20)

    department_rel = relationship("Department", back_populates="faculty")
    courses = relationship("Course", back_populates="faculty")
    availability = relationship("FacultyAvailability", back_populates="faculty")
    preferences = relationship("FacultyPreference", back_populates="faculty")
    timetable_entries = relationship("TimetableEntry", back_populates="faculty")

class Course(Base, TimestampMixin):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    credits = Column(Integer, default=3)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    semester = Column(String(50), nullable=True)  # e.g., 'Semester 1 & 2', 'Semester 5'
    is_lab = Column(Boolean, default=False)
    default_periods_per_week = Column(Integer, default=3)
    min_periods = Column(Integer, default=1)

    department = relationship("Department", back_populates="courses")
    faculty = relationship("Faculty", back_populates="courses")
    sections = relationship("Section", back_populates="course")
    timetable_entries = relationship("TimetableEntry", back_populates="course")

class Section(Base, TimestampMixin):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    section_number = Column(String(20), nullable=False)
    capacity = Column(Integer, default=30)
    current_enrollment = Column(Integer, default=0)
    periods_per_week = Column(Integer, default=3)
    requires_lab = Column(Boolean, default=False)

    course = relationship("Course", back_populates="sections")
    timetable_entries = relationship("TimetableEntry", back_populates="section")

class Room(Base, TimestampMixin):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(50), unique=True, index=True, nullable=False)
    building = Column(String(100))
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    capacity = Column(Integer, default=50)
    has_projector = Column(Boolean, default=True)
    has_computer = Column(Boolean, default=False)
    room_type = Column(String(50))  # lecture, lab, tutorial

    department_rel = relationship("Department", back_populates="rooms")
    availability = relationship("RoomAvailability", back_populates="room")
    timetable_entries = relationship("TimetableEntry", back_populates="room")

class TimeSlot(Base, TimestampMixin):
    __tablename__ = "time_slots"


    id = Column(Integer, primary_key=True, index=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday .. 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_break = Column(Boolean, default=False)
    label = Column(String(50))

    entries = relationship("TimetableEntry", back_populates="time_slot")
    faculty_availability = relationship("FacultyAvailability", back_populates="time_slot")
    room_availability = relationship("RoomAvailability", back_populates="time_slot")

class Constraint(Base, TimestampMixin):
    __tablename__ = "constraints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    constraint_type = Column(String(50))  # hard, soft
    is_required = Column(Boolean, default=False)
    priority = Column(Integer, default=0)
    expression = Column(Text)  # JSON serialized rule

    timetable_entries = relationship("TimetableEntry", back_populates="constraint")

class FacultyAvailability(Base, TimestampMixin):
    __tablename__ = "faculty_availability"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"))
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"))
    is_available = Column(Boolean, default=True)  # False = explicitly unavailable

    faculty = relationship("Faculty", back_populates="availability")
    time_slot = relationship("TimeSlot", back_populates="faculty_availability")

class RoomAvailability(Base, TimestampMixin):
    __tablename__ = "room_availability"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"))
    is_available = Column(Boolean, default=True)

    room = relationship("Room", back_populates="availability")
    time_slot = relationship("TimeSlot", back_populates="room_availability")

class FacultyPreference(Base, TimestampMixin):
    __tablename__ = "faculty_preferences"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"))
    preference_type = Column(String(50))  # gap, consecutive, late, early
    preference_value = Column(String(255))
    weight = Column(Float, default=1.0)

    faculty = relationship("Faculty", back_populates="preferences")

class Timetable(Base, TimestampMixin):
    __tablename__ = "timetables"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(100), nullable=False)
    version = Column(Integer, default=1)
    is_finalized = Column(Boolean, default=False)
    generated_at = Column(DateTime, default=_now)
    metadata_json = Column(Text)  # extra info: scores, constraints info

    user = relationship("User", back_populates="timetables")
    entries = relationship("TimetableEntry", back_populates="timetable")

class TimetableEntry(Base, TimestampMixin):
    __tablename__ = "timetable_entries"

    id = Column(Integer, primary_key=True, index=True)
    timetable_id = Column(Integer, ForeignKey("timetables.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    constraint_id = Column(Integer, ForeignKey("constraints.id"), nullable=True)
    entry_type = Column(String(50))  # class, lab, tutorial
    is_primary = Column(Boolean, default=True)

    timetable = relationship("Timetable", back_populates="entries")
    course = relationship("Course", back_populates="timetable_entries")
    section = relationship("Section", back_populates="timetable_entries")
    room = relationship("Room", back_populates="timetable_entries")
    time_slot = relationship("TimeSlot", back_populates="entries")
    faculty = relationship("Faculty", back_populates="timetable_entries")
    constraint = relationship("Constraint", back_populates="timetable_entries")
