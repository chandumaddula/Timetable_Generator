"""All REST API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, time

from app.database import get_db
from app.models.base import (
    Course, Faculty, Section, Room, TimeSlot, Constraint,
    FacultyAvailability, RoomAvailability, FacultyPreference,
    Timetable, TimetableEntry
)
from app.schemas import (
    CourseCreate, CourseUpdate, CourseOut,
    FacultyCreate, FacultyUpdate, FacultyOut,
    SectionCreate, SectionUpdate, SectionOut,
    RoomCreate, RoomUpdate, RoomOut,
    TimeSlotCreate, TimeSlotUpdate, TimeSlotOut,
    ConstraintCreate, ConstraintUpdate, ConstraintOut,
    FacultyAvailabilityCreate, FacultyAvailabilityOut,
    RoomAvailabilityCreate, RoomAvailabilityOut,
    FacultyPreferenceCreate, FacultyPreferenceOut,
    TimetableCreate, TimetableUpdate, TimetableOut,
    TimetableEntryCreate, TimetableEntryUpdate, TimetableEntryOut,
    GenerateTimetableRequest, ValidationResult, AnalyticsData,
)
from sqlalchemy import distinct, func
from app.algorithms.scheduler import TimetableScheduler, GenerationInput
from app.validators import TimetableValidator, assignments_from_timetable_entries
from app.constraints import ConstraintEngine

router = APIRouter(tags=["API v1"])

# ---- Health ----
@router.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}

# ==================== COURSES ====================
@router.get("/courses", response_model=List[CourseOut])
def list_courses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Course).offset(skip).limit(limit).all()

@router.get("/courses/{course_id}", response_model=CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

@router.post("/courses", response_model=CourseOut)
def create_course(data: CourseCreate, db: Session = Depends(get_db)):
    if db.query(Course).filter(Course.code == data.code).first():
        raise HTTPException(status_code=400, detail="Course code already exists")
    course = Course(**data.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course

@router.put("/courses/{course_id}", response_model=CourseOut)
def update_course(course_id: int, data: CourseUpdate, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(course, k, v)
    db.commit()
    db.refresh(course)
    return course

@router.delete("/courses/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()
    return {"deleted": True}

# ==================== FACULTY ====================
@router.get("/faculty", response_model=List[FacultyOut])
def list_faculty(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Faculty).offset(skip).limit(limit).all()

@router.get("/faculty/{faculty_id}", response_model=FacultyOut)
def get_faculty(faculty_id: int, db: Session = Depends(get_db)):
    f = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Faculty not found")
    return f

@router.post("/faculty", response_model=FacultyOut)
def create_faculty(data: FacultyCreate, db: Session = Depends(get_db)):
    f = Faculty(**data.model_dump())
    db.add(f)
    db.commit()
    db.refresh(f)
    return f

@router.put("/faculty/{faculty_id}", response_model=FacultyOut)
def update_faculty(faculty_id: int, data: FacultyUpdate, db: Session = Depends(get_db)):
    f = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Faculty not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(f, k, v)
    db.commit()
    db.refresh(f)
    return f

@router.delete("/faculty/{faculty_id}")
def delete_faculty(faculty_id: int, db: Session = Depends(get_db)):
    f = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Faculty not found")
    db.delete(f)
    db.commit()
    return {"deleted": True}

# ==================== SECTIONS ====================
@router.get("/sections", response_model=List[SectionOut])
def list_sections(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Section).offset(skip).limit(limit).all()

@router.get("/sections/{section_id}", response_model=SectionOut)
def get_section(section_id: int, db: Session = Depends(get_db)):
    s = db.query(Section).filter(Section.id == section_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Section not found")
    return s

@router.post("/sections", response_model=SectionOut)
def create_section(data: SectionCreate, db: Session = Depends(get_db)):
    s = Section(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s

@router.put("/sections/{section_id}", response_model=SectionOut)
def update_section(section_id: int, data: SectionUpdate, db: Session = Depends(get_db)):
    s = db.query(Section).filter(Section.id == section_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Section not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s

@router.delete("/sections/{section_id}")
def delete_section(section_id: int, db: Session = Depends(get_db)):
    s = db.query(Section).filter(Section.id == section_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Section not found")
    db.delete(s)
    db.commit()
    return {"deleted": True}

# ==================== ROOMS ====================
@router.get("/rooms", response_model=List[RoomOut])
def list_rooms(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Room).offset(skip).limit(limit).all()

@router.get("/rooms/{room_id}", response_model=RoomOut)
def get_room(room_id: int, db: Session = Depends(get_db)):
    r = db.query(Room).filter(Room.id == room_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    return r

@router.post("/rooms", response_model=RoomOut)
def create_room(data: RoomCreate, db: Session = Depends(get_db)):
    if db.query(Room).filter(Room.room_number == data.room_number).first():
        raise HTTPException(status_code=400, detail="Room number already exists")
    r = Room(**data.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r

@router.put("/rooms/{room_id}", response_model=RoomOut)
def update_room(room_id: int, data: RoomUpdate, db: Session = Depends(get_db)):
    r = db.query(Room).filter(Room.id == room_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r

@router.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db)):
    r = db.query(Room).filter(Room.id == room_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    db.delete(r)
    db.commit()
    return {"deleted": True}

# ==================== TIME SLOTS ====================
@router.get("/time-slots", response_model=List[TimeSlotOut])
def list_time_slots(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    return db.query(TimeSlot).offset(skip).limit(limit).all()

@router.get("/time-slots/{ts_id}", response_model=TimeSlotOut)
def get_time_slot(ts_id: int, db: Session = Depends(get_db)):
    ts = db.query(TimeSlot).filter(TimeSlot.id == ts_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Time slot not found")
    return ts

@router.post("/time-slots", response_model=TimeSlotOut)
def create_time_slot(data: TimeSlotCreate, db: Session = Depends(get_db)):
    ts = TimeSlot(**data.model_dump())
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return ts

@router.put("/time-slots/{ts_id}", response_model=TimeSlotOut)
def update_time_slot(ts_id: int, data: TimeSlotUpdate, db: Session = Depends(get_db)):
    ts = db.query(TimeSlot).filter(TimeSlot.id == ts_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Time slot not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(ts, k, v)
    db.commit()
    db.refresh(ts)
    return ts

@router.delete("/time-slots/{ts_id}")
def delete_time_slot(ts_id: int, db: Session = Depends(get_db)):
    ts = db.query(TimeSlot).filter(TimeSlot.id == ts_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Time slot not found")
    db.delete(ts)
    db.commit()
    return {"deleted": True}

# ==================== CONSTRAINTS ====================
@router.get("/constraints", response_model=List[ConstraintOut])
def list_constraints(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Constraint).offset(skip).limit(limit).all()

@router.post("/constraints", response_model=ConstraintOut)
def create_constraint(data: ConstraintCreate, db: Session = Depends(get_db)):
    c = Constraint(**data.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@router.put("/constraints/{constraint_id}", response_model=ConstraintOut)
def update_constraint(constraint_id: int, data: ConstraintUpdate, db: Session = Depends(get_db)):
    c = db.query(Constraint).filter(Constraint.id == constraint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Constraint not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c

@router.delete("/constraints/{constraint_id}")
def delete_constraint(constraint_id: int, db: Session = Depends(get_db)):
    c = db.query(Constraint).filter(Constraint.id == constraint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Constraint not found")
    db.delete(c)
    db.commit()
    return {"deleted": True}

# ==================== AVAILABILITY & PREFERENCES ====================
@router.post("/faculty-availability", response_model=FacultyAvailabilityOut)
def create_faculty_availability(data: FacultyAvailabilityCreate, db: Session = Depends(get_db)):
    fa = FacultyAvailability(**data.model_dump())
    db.add(fa)
    db.commit()
    db.refresh(fa)
    return fa

@router.get("/faculty-availability", response_model=List[FacultyAvailabilityOut])
def list_faculty_availability(
    faculty_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(FacultyAvailability)
    if faculty_id:
        q = q.filter(FacultyAvailability.faculty_id == faculty_id)
    return q.all()

@router.post("/room-availability", response_model=RoomAvailabilityOut)
def create_room_availability(data: RoomAvailabilityCreate, db: Session = Depends(get_db)):
    ra = RoomAvailability(**data.model_dump())
    db.add(ra)
    db.commit()
    db.refresh(ra)
    return ra

@router.get("/room-availability", response_model=List[RoomAvailabilityOut])
def list_room_availability(
    room_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(RoomAvailability)
    if room_id:
        q = q.filter(RoomAvailability.room_id == room_id)
    return q.all()

@router.post("/faculty-preferences", response_model=FacultyPreferenceOut)
def create_faculty_preference(data: FacultyPreferenceCreate, db: Session = Depends(get_db)):
    fp = FacultyPreference(**data.model_dump())
    db.add(fp)
    db.commit()
    db.refresh(fp)
    return fp

@router.get("/faculty-preferences", response_model=List[FacultyPreferenceOut])
def list_faculty_preferences(
    faculty_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(FacultyPreference)
    if faculty_id:
        q = q.filter(FacultyPreference.faculty_id == faculty_id)
    return q.all()

# ==================== TIMETABLE GENERATION ====================
# -- Department & Semester endpoints --
@router.get("/departments", response_model=List[str])
def list_departments(db: Session = Depends(get_db)):
    """Get distinct departments from faculty."""
    depts = db.query(distinct(Faculty.department)).filter(Faculty.department.isnot(None)).all()
    return [d[0] for d in depts if d[0]]

@router.get("/semesters", response_model=List[str])
def list_semesters(db: Session = Depends(get_db)):
    """Get distinct semesters from sections."""
    # Semester is often encoded in section_number like "Sec-A1" where A = semester
    # For now, return common semesters
    return ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"]


@router.post("/timetable/generate")
async def generate_timetable(data: GenerateTimetableRequest, db: Session = Depends(get_db)):
    # Build base queries
    courses_q = db.query(Course)
    sections_q = db.query(Section)
    faculty_q = db.query(Faculty)
    rooms_q = db.query(Room)
    time_slots_q = db.query(TimeSlot)

    # Apply department filter (on faculty)
    if data.department:
        faculty_q = faculty_q.filter(Faculty.department == data.department)
        # Get faculty IDs for this department
        fac_ids = [f.id for f in faculty_q.all()]
        # Filter courses by those faculty
        courses_q = courses_q.filter(Course.faculty_id.in_(fac_ids))
        # Filter sections by those courses
        course_ids = [c.id for c in courses_q.all()]
        sections_q = sections_q.filter(Section.course_id.in_(course_ids))

    # Apply semester filter (on section_number pattern)
    if data.semester:
        # Extract semester from section_number like "Sec-A1" -> "A"
        # For simplicity, filter sections where section_number contains semester char
        sem_map = {
            "Semester 1": "A", "Semester 2": "B", "Semester 3": "C", "Semester 4": "D",
            "Semester 5": "E", "Semester 6": "F", "Semester 7": "G", "Semester 8": "H",
        }
        sem_char = sem_map.get(data.semester, "")
        if sem_char:
            sections_q = sections_q.filter(Section.section_number.like(f"%{sem_char}%"))

    # Apply course filter
    if data.courses:
        courses_q = courses_q.filter(Course.id.in_(data.courses))
        course_ids = [c.id for c in courses_q.all()]
        sections_q = sections_q.filter(Section.course_id.in_(course_ids))

    # Apply time slot filters
    if data.time_start or data.time_end:
        if data.time_start:
            from datetime import time as dt_time
            h, m = map(int, data.time_start.split(":"))
            time_slots_q = time_slots_q.filter(TimeSlot.start_time >= dt_time(h, m))
        if data.time_end:
            from datetime import time as dt_time
            h, m = map(int, data.time_end.split(":"))
            time_slots_q = time_slots_q.filter(TimeSlot.end_time <= dt_time(h, m))

    # Apply num_sections limit
    if data.num_sections:
        sections_q = sections_q.limit(data.num_sections)

    # Apply num_rooms limit
    if data.num_rooms:
        rooms_q = rooms_q.limit(data.num_rooms)

    courses = courses_q.all()
    sections = sections_q.all()
    faculty = faculty_q.all()
    rooms = rooms_q.all()
    time_slots = time_slots_q.all()
    faculty_avail = db.query(FacultyAvailability).all()
    room_avail = db.query(RoomAvailability).all()
    faculty_prefs = db.query(FacultyPreference).all()

    result = TimetableScheduler(GenerationInput(
        courses=courses,
        sections=sections,
        faculty=faculty,
        rooms=rooms,
        time_slots=time_slots,
        faculty_avail=faculty_avail,
        room_avail=room_avail,
        faculty_prefs=faculty_prefs,
        section_filter=data.sections,
        room_filter=data.rooms,
        faculty_filter=data.faculty,
        optimize=data.optimize,
        max_iterations=data.max_iterations,
    )).generate()

    # Persist the result
    timetable = Timetable(
        name=data.name,
        generated_at=datetime.utcnow(),
        metadata_json=str({
            "score": result.validation.score,
            "hard_violations": result.validation.hard_violations,
            "soft_violations": result.validation.soft_violations,
        }),
    )
    db.add(timetable)
    db.commit()
    db.refresh(timetable)

    # Persist entries
    for a in result.assignments:
        entry = TimetableEntry(
            timetable_id=timetable.id,
            course_id=a.course_id,
            section_id=a.section_id,
            room_id=a.room_id,
            time_slot_id=a.time_slot_id,
            faculty_id=a.faculty_id,
            entry_type="lab" if a.is_lab else "class",
        )
        db.add(entry)
    db.commit()

    return {
        "timetable_id": timetable.id,
        "success": result.success,
        "message": result.message,
        "validation": result.validation.to_dict(),
        "assignments_count": len(result.assignments),
        "conflicts": result.conflicts,
        "filter_summary": {
            "courses_count": len(courses),
            "sections_count": len(sections),
            "faculty_count": len(faculty),
            "rooms_count": len(rooms),
            "time_slots_count": len(time_slots),
            "department": data.department,
            "semester": data.semester,
            "num_sections": data.num_sections,
            "num_rooms": data.num_rooms,
        }
    }

# ==================== TIMETABLES CRUD ====================
@router.get("/timetables", response_model=List[TimetableOut])
def list_timetables(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Timetable).offset(skip).limit(limit).all()

@router.get("/timetables/{timetable_id}", response_model=TimetableOut)
def get_timetable(timetable_id: int, db: Session = Depends(get_db)):
    t = db.query(Timetable).filter(Timetable.id == timetable_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Timetable not found")
    return t

@router.delete("/timetables/{timetable_id}")
def delete_timetable(timetable_id: int, db: Session = Depends(get_db)):
    t = db.query(Timetable).filter(Timetable.id == timetable_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Timetable not found")
    db.query(TimetableEntry).filter(TimetableEntry.timetable_id == timetable_id).delete()
    db.delete(t)
    db.commit()
    return {"deleted": True}

@router.put("/timetables/{timetable_id}/finalize", response_model=TimetableOut)
def finalize_timetable(timetable_id: int, db: Session = Depends(get_db)):
    t = db.query(Timetable).filter(Timetable.id == timetable_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Timetable not found")
    t.is_finalized = True
    db.commit()
    db.refresh(t)
    return t

# ==================== TIMETABLE ENTRIES ====================
@router.get("/timetables/{timetable_id}/entries", response_model=List[TimetableEntryOut])
def list_timetable_entries(timetable_id: int, db: Session = Depends(get_db)):
    return db.query(TimetableEntry).filter(TimetableEntry.timetable_id == timetable_id).all()

@router.post("/timetables/{timetable_id}/entries", response_model=TimetableEntryOut)
def create_entry(timetable_id: int, data: TimetableEntryCreate, db: Session = Depends(get_db)):
    entry = TimetableEntry(timetable_id=timetable_id, **data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

# ==================== VALIDATION ====================
@router.post("/validate")
def validate_timetable(timetable_id: int, db: Session = Depends(get_db)) -> dict:
    """Validate a timetable for constraint violations."""
    entries = db.query(TimetableEntry).filter(TimetableEntry.timetable_id == timetable_id).all()
    if not entries:
        return {
            "valid": True,
            "score": 100.0,
            "hard_violations": 0,
            "soft_violations": 0,
            "issues": []
        }

    courses = db.query(Course).all()
    sections = db.query(Section).all()
    rooms = db.query(Room).all()
    time_slots = db.query(TimeSlot).all()
    faculty = db.query(Faculty).all()
    faculty_avail = db.query(FacultyAvailability).all()
    room_avail = db.query(RoomAvailability).all()
    faculty_prefs = db.query(FacultyPreference).all()

    from app.validators import assignments_from_timetable_entries
    assignments = assignments_from_timetable_entries(entries, courses, sections, rooms, time_slots, faculty)

    engine = ConstraintEngine(faculty, courses, sections, rooms, time_slots, faculty_avail, room_avail, faculty_prefs)
    validator = TimetableValidator(engine)
    result = validator.validate(assignments)
    return result.to_dict()

# ==================== FACULTY TIMETABLE ====================
@router.get("/faculty/{faculty_id}/timetable")
def faculty_timetable(faculty_id: int, timetable_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get timetable for a specific faculty member."""
    q = db.query(TimetableEntry).filter(TimetableEntry.faculty_id == faculty_id)
    if timetable_id:
        q = q.filter(TimetableEntry.timetable_id == timetable_id)
    entries = q.all()
    return _format_timetable_entries(entries, db)

# ==================== SECTION TIMETABLE ====================
@router.get("/sections/{section_id}/timetable")
def section_timetable(section_id: int, timetable_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get timetable for a specific section."""
    q = db.query(TimetableEntry).filter(TimetableEntry.section_id == section_id)
    if timetable_id:
        q = q.filter(TimetableEntry.timetable_id == timetable_id)
    entries = q.all()
    return _format_timetable_entries(entries, db)

# ==================== ROOM TIMETABLE ====================
@router.get("/rooms/{room_id}/timetable")
def room_timetable(room_id: int, timetable_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get timetable for a specific room."""
    q = db.query(TimetableEntry).filter(TimetableEntry.room_id == room_id)
    if timetable_id:
        q = q.filter(TimetableEntry.timetable_id == timetable_id)
    entries = q.all()
    return _format_timetable_entries(entries, db)

# ==================== ANALYTICS ====================
@router.get("/analytics")
def analytics(timetable_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get analytics for a timetable."""
    entries_q = db.query(TimetableEntry)
    if timetable_id:
        entries_q = entries_q.filter(TimetableEntry.timetable_id == timetable_id)
    entries = entries_q.all()

    if not entries:
        return {
            "total_entries": 0,
            "faculty_utilization": {},
            "room_utilization": {},
            "time_slot_utilization": {},
            "section_load": {},
            "course_frequency": {},
        }

    # Faculty utilization: hours per faculty
    faculty_hours: Dict[int, int] = {}
    room_usage: Dict[int, int] = {}
    slot_usage: Dict[int, int] = {}
    section_load: Dict[int, int] = {}
    course_freq: Dict[int, int] = {}

    for e in entries:
        faculty_hours[e.faculty_id] = faculty_hours.get(e.faculty_id, 0) + 1
        room_usage[e.room_id] = room_usage.get(e.room_id, 0) + 1
        slot_usage[e.time_slot_id] = slot_usage.get(e.time_slot_id, 0) + 1
        section_load[e.section_id] = section_load.get(e.section_id, 0) + 1
        course_freq[e.course_id] = course_freq.get(e.course_id, 0) + 1

    return {
        "total_entries": len(entries),
        "faculty_utilization": faculty_hours,
        "room_utilization": room_usage,
        "time_slot_utilization": slot_usage,
        "section_load": section_load,
        "course_frequency": course_freq,
    }

# ---- Helper ----
def _format_timetable_entries(entries, db: Session) -> List[dict]:
    """Format timetable entries with course, room, time_slot names."""
    result = []
    for e in entries:
        course = db.query(Course).filter(Course.id == e.course_id).first()
        room = db.query(Room).filter(Room.id == e.room_id).first()
        ts = db.query(TimeSlot).filter(TimeSlot.id == e.time_slot_id).first()
        faculty = db.query(Faculty).filter(Faculty.id == e.faculty_id).first()
        section = db.query(Section).filter(Section.id == e.section_id).first()
        result.append({
            "id": e.id,
            "course": course.code if course else None,
            "course_name": course.name if course else None,
            "section": section.section_number if section else None,
            "room": room.room_number if room else None,
            "building": room.building if room else None,
            "day": ts.day_of_week if ts else None,
            "start_time": str(ts.start_time) if ts else None,
            "end_time": str(ts.end_time) if ts else None,
            "faculty": faculty.name if faculty else None,
            "entry_type": e.entry_type,
        })
    return result