from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional, List, Union, Dict
from datetime import time, datetime
from enum import Enum

class ConstraintType(str, Enum):
    HARD = "hard"
    SOFT = "soft"

class RoomType(str, Enum):
    LECTURE = "lecture"
    LAB = "lab"
    TUTORIAL = "tutorial"

class EntryType(str, Enum):
    CLASS = "class"
    LAB = "lab"
    TUTORIAL = "tutorial"

# ---- Base schemas ----
class TimestampMixin(BaseModel):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# ---- User / Auth ----
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role_names: List[str] = []

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None

class UserOut(UserBase, TimestampMixin):
    id: int
    is_active: bool
    is_superuser: bool

    class Config:
        from_attributes = True

class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None

class RoleCreate(RoleBase):
    pass

class RoleOut(RoleBase, TimestampMixin):
    id: int
    class Config:
        from_attributes = True

# ---- Auth Token ----
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    username: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

# ---- Department ----
class DepartmentBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None

class DepartmentOut(DepartmentBase, TimestampMixin):
    id: int
    class Config:
        from_attributes = True

# ---- Faculty ----
class FacultyBase(BaseModel):
    name: str
    initials: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[int] = None
    email: Optional[str] = None
    is_full_time: bool = True
    max_hours_per_week: int = 20

class FacultyCreate(FacultyBase):
    pass

class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    initials: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[int] = None
    email: Optional[str] = None
    is_full_time: Optional[bool] = None
    max_hours_per_week: Optional[int] = None

class FacultyOut(FacultyBase, TimestampMixin):
    id: int
    department_rel: Optional[DepartmentOut] = None
    class Config:
        from_attributes = True

# ---- Course ----
class CourseBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str
    description: Optional[str] = None
    credits: int = 3
    faculty_id: Optional[int] = None
    department_id: Optional[int] = None
    semester: Optional[str] = None
    is_lab: bool = False
    default_periods_per_week: int = 3
    min_periods: int = 1

class CourseCreate(CourseBase):
    pass

class CourseUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    credits: Optional[int] = None
    faculty_id: Optional[int] = None
    department_id: Optional[int] = None
    semester: Optional[str] = None
    is_lab: Optional[bool] = None
    default_periods_per_week: Optional[int] = None
    min_periods: Optional[int] = None

class CourseOut(CourseBase, TimestampMixin):
    id: int
    department: Optional[DepartmentOut] = None
    faculty: Optional[FacultyOut] = None
    class Config:
        from_attributes = True

# ---- Section ----
class SectionBase(BaseModel):
    course_id: int
    section_number: str
    capacity: int = 30
    current_enrollment: int = 0
    periods_per_week: int = 3
    requires_lab: bool = False

class SectionCreate(SectionBase):
    pass

class SectionUpdate(BaseModel):
    section_number: Optional[str] = None
    capacity: Optional[int] = None
    current_enrollment: Optional[int] = None
    periods_per_week: Optional[int] = None
    requires_lab: Optional[bool] = None

class SectionOut(SectionBase, TimestampMixin):
    id: int
    course: Optional[CourseOut] = None
    class Config:
        from_attributes = True

# ---- Room ----
class RoomBase(BaseModel):
    room_number: str
    building: Optional[str] = None
    capacity: int = 50
    has_projector: bool = True
    has_computer: bool = False
    room_type: Optional[RoomType] = None

class RoomCreate(RoomBase):
    pass

class RoomUpdate(BaseModel):
    building: Optional[str] = None
    capacity: Optional[int] = None
    has_projector: Optional[bool] = None
    has_computer: Optional[bool] = None
    room_type: Optional[RoomType] = None

class RoomOut(RoomBase, TimestampMixin):
    id: int
    class Config:
        from_attributes = True

# ---- TimeSlot ----
class TimeSlotBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: time
    end_time: time
    is_break: bool = False
    label: Optional[str] = None

    @field_validator('end_time')
    @classmethod
    def end_after_start(cls, v, info):
        if 'start_time' in info.data and v <= info.data['start_time']:
            raise ValueError('end_time must be after start_time')
        return v

class TimeSlotCreate(TimeSlotBase):
    pass

class TimeSlotUpdate(BaseModel):
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_break: Optional[bool] = None
    label: Optional[str] = None

class TimeSlotOut(TimeSlotBase, TimestampMixin):
    id: int
    class Config:
        from_attributes = True

# ---- Constraint ----
class ConstraintBase(BaseModel):
    name: str
    description: Optional[str] = None
    constraint_type: ConstraintType = ConstraintType.HARD
    is_required: bool = False
    priority: int = 0
    expression: Optional[str] = None

class ConstraintCreate(ConstraintBase):
    pass

class ConstraintUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    constraint_type: Optional[ConstraintType] = None
    is_required: Optional[bool] = None
    priority: Optional[int] = None
    expression: Optional[str] = None

class ConstraintOut(ConstraintBase, TimestampMixin):
    id: int
    class Config:
        from_attributes = True

# ---- Availability ----
class FacultyAvailabilityBase(BaseModel):
    faculty_id: int
    time_slot_id: int
    is_available: bool = True

class FacultyAvailabilityCreate(FacultyAvailabilityBase):
    pass

class FacultyAvailabilityOut(FacultyAvailabilityBase, TimestampMixin):
    id: int
    class Config:
        from_attributes = True

class RoomAvailabilityBase(BaseModel):
    room_id: int
    time_slot_id: int
    is_available: bool = True

class RoomAvailabilityCreate(RoomAvailabilityBase):
    pass

class RoomAvailabilityOut(RoomAvailabilityBase, TimestampMixin):
    id: int
    class Config:
        from_attributes = True

# ---- Preference ----
class FacultyPreferenceBase(BaseModel):
    faculty_id: int
    preference_type: str  # gap, consecutive, late, early
    preference_value: str
    weight: float = 1.0

class FacultyPreferenceCreate(FacultyPreferenceBase):
    pass

class FacultyPreferenceOut(FacultyPreferenceBase, TimestampMixin):
    id: int
    class Config:
        from_attributes = True

# ---- Timetable ----
class TimetableBase(BaseModel):
    name: str
    user_id: Optional[int] = None

class TimetableCreate(TimetableBase):
    pass

class TimetableUpdate(BaseModel):
    name: Optional[str] = None
    is_finalized: Optional[bool] = None

class TimetableOut(TimetableBase, TimestampMixin):
    id: int
    version: int
    is_finalized: bool
    generated_at: Optional[datetime] = None
    metadata_json: Optional[str] = None
    class Config:
        from_attributes = True

# ---- TimetableEntry ----
class TimetableEntryBase(BaseModel):
    course_id: int
    section_id: int
    room_id: int
    time_slot_id: int
    faculty_id: int
    constraint_id: Optional[int] = None
    entry_type: EntryType = EntryType.CLASS
    is_primary: bool = True

class TimetableEntryCreate(TimetableEntryBase):
    pass

class TimetableEntryUpdate(BaseModel):
    room_id: Optional[int] = None
    time_slot_id: Optional[int] = None
    constraint_id: Optional[int] = None
    entry_type: Optional[EntryType] = None
    is_primary: Optional[bool] = None

class TimetableEntryOut(TimetableEntryBase, TimestampMixin):
    id: int
    timetable_id: int
    course: Optional[CourseOut] = None
    section: Optional[SectionOut] = None
    room: Optional[RoomOut] = None
    time_slot: Optional[TimeSlotOut] = None
    faculty: Optional[FacultyOut] = None
    class Config:
        from_attributes = True

# ---- Semester ----
class SemesterOut(BaseModel):
    semester: str
    label: Optional[str] = None

# ---- Generation Request ----
class GenerateTimetableRequest(BaseModel):
    name: str = "Generated Timetable"
    timetable_id: Optional[int] = None  # reuse existing timetable
    sections: Optional[List[int]] = None  # filter by section IDs
    rooms: Optional[List[int]] = None  # filter by room IDs
    faculty: Optional[List[int]] = None  # filter by faculty IDs
    courses: Optional[List[int]] = None  # filter by course/subject IDs
    department_id: Optional[int] = None  # filter by department ID
    department: Optional[str] = None  # filter by department name
    semester: Optional[Union[int, str]] = None  # filter by semester number or string
    time_start: Optional[str] = None  # filter time slots start time (HH:MM)
    time_end: Optional[str] = None  # filter time slots end time (HH:MM)
    num_sections: Optional[int] = None  # number of sections to generate for
    num_rooms: Optional[int] = None  # number of rooms required per section
    optimize: bool = True
    max_iterations: int = 1000

# ---- Validation Result ----
class ValidationIssue(BaseModel):
    severity: str  # error, warning, info
    message: str
    entry_ids: List[int] = []
    suggestion: Optional[str] = None

class ValidationResult(BaseModel):
    valid: bool
    score: float = 0.0
    hard_violations: int = 0
    soft_violations: int = 0
    issues: List[ValidationIssue] = []

# ---- Analytics ----
class AnalyticsData(BaseModel):
    total_entries: int
    faculty_utilization: dict
    room_utilization: dict
    time_slot_utilization: dict
    section_load: dict
    course_frequency: dict

# ---- Excel Import ----
class ExcelImportCounts(BaseModel):
    faculty: int = 0
    courses: int = 0
    sections: int = 0
    rooms: int = 0
    time_slots: int = 0
    constraints: int = 0

class ExcelImportResponse(BaseModel):
    success: bool
    message: str
    counts: ExcelImportCounts
    errors: List[str] = []

