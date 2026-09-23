"""Seed data for the timetable generator.

Creates approximately:
- 20-40 courses  (we seed 20)
- 10-20 faculty (we seed 12 + 5 auth users)
- 4-8 sections  (we seed 16)
- 8-12 rooms    (we seed 10)
- 25-35 time slots (we seed 30)

Includes meaningful conflicts (shared faculty, overlapping availability)
so the algorithm can be demonstrated.
"""
import random
from datetime import time
from app.database import init_db, SessionLocal, engine
from app.models.base import (
    Base, User, Role, UserRole, Faculty, Course, Section, Room, TimeSlot,
    FacultyAvailability, RoomAvailability, FacultyPreference, Constraint
)
from app.security import hash_password

random.seed(42)

FACULTY_NAMES = [
    "Prof. Alan Turing", "Prof. Grace Hopper", "Prof. Donald Knuth",
    "Prof. Barbara Liskov", "Prof. Andrew Ng", "Prof. Fei-Fei Li",
    "Prof. Jeff Dean", "Prof. Ilya Sutskever", "Prof. Demis Hassabis",
    "Prof. Sebastian Thrun", "Prof. Leslie Valiant", "Prof. Shafi Goldwasser",
    "Prof. Michael Jordan", "Prof. Yann LeCun",
]

DEPARTMENTS = ["Computer Science", "Electrical Engineering", "Mathematics",
               "Physics", "Data Science", "Robotics"]

COURSES = [
    ("CS101", "Intro to Programming", True, 3),
    ("CS102", "Data Structures", True, 3),
    ("CS201", "Algorithms", True, 3),
    ("CS202", "Linear Algebra", True, 3),
    ("CS301", "Calculus", True, 4),
    ("CS302", "Database Systems", False, 3),
    ("CS303", "Operating Systems", False, 3),
    ("CS304", "Artificial Intelligence", False, 3),
    ("CS305", "Physics I", True, 4),
    ("CS306", "Physics II", True, 4),
    ("CS307", "Machine Learning", False, 3),
    ("CS308", "Web Development", True, 3),
    ("CS309", "Computer Networks", False, 3),
    ("CS310", "Theory of Computation", False, 3),
    ("CS311", "Software Engineering", False, 3),
    ("CS312", "Computer Graphics", True, 3),
    ("CS313", "Cryptography", False, 3),
    ("CS314", "Data Mining", True, 3),
    ("CS315", "Numerical Methods", False, 3),
    ("CS316", "Distributed Systems", False, 3),
]
# Note: courses 0,1,2,3,4,8,9,11,14,16,18 are labs-ish (is_lab True)


def seed_users(db):
    usernames = ["admin", "faculty1", "faculty2", "faculty3", "faculty4"]
    emails = ["admin@school.edu", "f1@school.edu", "f2@school.edu", "f3@school.edu", "f4@school.edu"]
    admin_role = Role(name="admin", description="System administrator")
    faculty_role = Role(name="faculty", description="Faculty member")
    db.add(admin_role)
    db.add(faculty_role)
    db.commit()

    users = []
    for i, (uname, email) in enumerate(zip(usernames, emails)):
        u = User(
            username=uname,
            email=email,
            full_name=f"User {uname}",
            hashed_password=hash_password("password123"),
            is_active=True,
            is_superuser=(i == 0),
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        users.append(u)

        if i == 0:
            db.add(UserRole(user_id=u.id, role_id=admin_role.id))
        else:
            db.add(UserRole(user_id=u.id, role_id=faculty_role.id))
    db.commit()
    return users


def seed_faculty(db, n=14):
    faculty = []
    for i in range(n):
        f = Faculty(
            name=FACULTY_NAMES[i],
            department=DEPARTMENTS[i % len(DEPARTMENTS)],
            email=f"f{i+1}@school.edu",
            is_full_time=True,
            max_hours_per_week=18 + (i % 3) * 2,
        )
        db.add(f)
        db.commit()
        db.refresh(f)
        faculty.append(f)
    return faculty


def seed_courses(db, faculty):
    courses = []
    for i, (code, name, is_lab, credits) in enumerate(COURSES):
        fac_id = faculty[i % len(faculty)].id
        c = Course(
            code=code,
            name=name,
            description=f"Course {code}: {name}",
            credits=credits,
            faculty_id=fac_id,
            is_lab=is_lab,
            default_periods_per_week=2 if is_lab else 3,
            min_periods=1,
        )
        db.add(c)
        db.commit()
        db.refresh(c)
        courses.append(c)
    return courses


def seed_sections(db, courses, n=16):
    """Create sections for courses. 16 sections across multiple courses."""
    sections = []
    for i in range(n):
        course = courses[i % len(courses)]
        sec = Section(
            course_id=course.id,
            section_number=f"Sec-{chr(65 + (i // 4))}{i % 4 + 1}",
            capacity=25 + (i * 3),
            current_enrollment=random.randint(20, 35),
            periods_per_week=course.default_periods_per_week,
            requires_lab=course.is_lab,
        )
        db.add(sec)
        db.commit()
        db.refresh(sec)
        sections.append(sec)
    return sections


def seed_rooms(db, n=10):
    room_types = ["lecture", "lab", "tutorial"]
    buildings = ["Main Building", "Engineering Building", "Science Building", "Arts Building"]
    rooms = []
    for i in range(n):
        rt = room_types[i % 3]
        r = Room(
            room_number=f"Room {i+101}",
            building=buildings[i % len(buildings)],
            capacity=30 + (i * 8),
            has_projector=(i % 3 != 0),
            has_computer=(i % 3 == 0),
            room_type=rt,
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        rooms.append(r)
    return rooms


def seed_time_slots(db):
    days = [0, 1, 2, 3, 4]  # Mon-Fri
    slots = []
    idx = 1
    # Standard period hours: 8-9, 9-10, 10-11, 11-12, 12-13 (Break), 13-14, 14-15, 15-16, 16-17
    hours = [
        (8, 9, False, "Period 1"),
        (9, 10, False, "Period 2"),
        (10, 11, False, "Period 3"),
        (11, 12, False, "Period 4"),
        (12, 13, True, "Lunch Break"),
        (13, 14, False, "Period 5"),
        (14, 15, False, "Period 6"),
        (15, 16, False, "Period 7"),
        (16, 17, False, "Period 8"),
    ]
    for day in days:
        for start_h, end_h, is_brk, label_prefix in hours:
            lbl = f"{label_prefix}" if is_brk else f"Slot {idx}"
            if not is_brk:
                idx += 1
            slots.append(TimeSlot(
                day_of_week=day,
                start_time=time(start_h, 0),
                end_time=time(end_h, 0),
                is_break=is_brk,
                label=lbl
            ))
    db.add_all(slots)
    db.commit()
    for s in slots:
        db.refresh(s)
    return slots


def seed_availability(db, faculty, time_slots):
    avail = []
    for f in faculty:
        # Each faculty is unavailable 2-4 slots per week
        count = random.randint(2, 4)
        indices = random.sample(range(len(time_slots)), count)
        for idx in indices:
            avail.append(FacultyAvailability(
                faculty_id=f.id,
                time_slot_id=time_slots[idx].id,
                is_available=False,
            ))
    db.add_all(avail)
    db.commit()
    return avail


def seed_room_availability(db, rooms, time_slots):
    ra = []
    for r in rooms:
        count = random.randint(1, 3)
        indices = random.sample(range(len(time_slots)), count)
        for idx in indices:
            ra.append(RoomAvailability(
                room_id=r.id,
                time_slot_id=time_slots[idx].id,
                is_available=False,
            ))
    db.add_all(ra)
    db.commit()
    return ra


def seed_preferences(db, faculty):
    prefs = []
    for f in faculty:
        if random.random() > 0.3:
            prefs.append(FacultyPreference(
                faculty_id=f.id,
                preference_type="no_late",
                preference_value="avoid classes after 16:00",
                weight=1.5,
            ))
        if random.random() > 0.3:
            prefs.append(FacultyPreference(
                faculty_id=f.id,
                preference_type="consecutive",
                preference_value="prefer back-to-back periods",
                weight=1.2,
            ))
    db.add_all(prefs)
    db.commit()
    return prefs


def seed_constraints(db):
    constraints = [
        Constraint(
            name="No Faculty Overlap",
            description="A faculty member cannot teach two courses at the same time",
            constraint_type="hard",
            is_required=True,
            priority=10,
        ),
        Constraint(
            name="No Section Overlap",
            description="A section cannot have two classes at the same time",
            constraint_type="hard",
            is_required=True,
            priority=9,
        ),
        Constraint(
            name="No Room Overlap",
            description="A room cannot host two classes at the same time",
            constraint_type="hard",
            is_required=True,
            priority=8,
        ),
        Constraint(
            name="Room Capacity",
            description="Room capacity must meet section demand",
            constraint_type="hard",
            is_required=True,
            priority=7,
        ),
        Constraint(
            name="Faculty Availability",
            description="Faculty must be available in assigned slots",
            constraint_type="hard",
            is_required=True,
            priority=6,
        ),
        Constraint(
            name="Lab Requirements",
            description="Lab sessions must use a lab room",
            constraint_type="hard",
            is_required=True,
            priority=5,
        ),
        Constraint(
            name="Break Periods",
            description="No classes during break slots",
            constraint_type="hard",
            is_required=True,
            priority=4,
        ),
        Constraint(
            name="Workload Balance",
            description="Faculty workload should be balanced",
            constraint_type="soft",
            is_required=False,
            priority=3,
        ),
        Constraint(
            name="Faculty Gaps",
            description="Minimize idle gaps between classes",
            constraint_type="soft",
            is_required=False,
            priority=2,
        ),
        Constraint(
            name="Student Gaps",
            description="Minimize gaps in student schedules",
            constraint_type="soft",
            is_required=False,
            priority=1,
        ),
    ]
    db.add_all(constraints)
    db.commit()
    return constraints


def seed_all():
    """Run all seeding."""
    Base.metadata.drop_all(bind=engine)
    init_db()

    db = SessionLocal()

    users = seed_users(db)
    print(f"Seeded {len(users)} users + roles")

    faculty = seed_faculty(db, 14)
    print(f"Seeded {len(faculty)} faculty")

    courses = seed_courses(db, faculty)
    print(f"Seeded {len(courses)} courses")

    sections = seed_sections(db, courses, 16)
    print(f"Seeded {len(sections)} sections")

    rooms = seed_rooms(db, 10)
    print(f"Seeded {len(rooms)} rooms")

    time_slots = seed_time_slots(db)
    print(f"Seeded {len(time_slots)} time slots")

    avail = seed_availability(db, faculty, time_slots)
    print(f"Seeded {len(avail)} faculty availability records")

    ra = seed_room_availability(db, rooms, time_slots)
    print(f"Seeded {len(ra)} room availability records")

    prefs = seed_preferences(db, faculty)
    print(f"Seeded {len(prefs)} faculty preferences")

    constraints = seed_constraints(db)
    print(f"Seeded {len(constraints)} constraints")

    # Create a default admin user linking one faculty
    db.close()
    print("\nAll seed data created successfully!")


if __name__ == "__main__":
    seed_all()
