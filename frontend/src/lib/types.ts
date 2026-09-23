export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Department extends Record<string, unknown> {
  id: number;
  name: string;
  code?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SemesterItem {
  semester: number;
  label: string;
}

export interface Faculty extends Record<string, unknown> {
  id: number;
  name: string;
  department?: string;
  department_id?: number;
  department_rel?: Department;
  email?: string;
  is_full_time: boolean;
  max_hours_per_week: number;
  created_at?: string;
  updated_at?: string;
}

export interface Course extends Record<string, unknown> {
  id: number;
  code: string;
  name: string;
  description?: string;
  department_id?: number;
  department?: Department;
  semester?: number;
  credits: number;
  faculty_id?: number;
  faculty?: Faculty;
  is_lab: boolean;
  default_periods_per_week: number;
  min_periods: number;
  created_at?: string;
  updated_at?: string;
}

export interface Section extends Record<string, unknown> {
  id: number;
  course_id: number;
  course?: Course;
  section_number: string;
  capacity: number;
  current_enrollment: number;
  periods_per_week: number;
  requires_lab: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Room extends Record<string, unknown> {
  id: number;
  room_number: string;
  building?: string;
  capacity: number;
  has_projector: boolean;
  has_computer: boolean;
  room_type: string;
  created_at?: string;
  updated_at?: string;
}

export interface TimeSlot extends Record<string, unknown> {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
  label?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Constraint extends Record<string, unknown> {
  id: number;
  name: string;
  description?: string;
  constraint_type: "hard" | "soft";
  is_required: boolean;
  priority: number;
  expression?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FacultyAvailability {
  id: number;
  faculty_id: number;
  time_slot_id: number;
  is_available: boolean;
}

export interface Timetable extends Record<string, unknown> {
  id: number;
  name: string;
  user_id?: number;
  version: number;
  is_finalized: boolean;
  generated_at: string;
  metadata_json?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TimetableEntry {
  id: number;
  timetable_id: number;
  course_id: number;
  section_id: number;
  room_id: number;
  time_slot_id: number;
  faculty_id: number;
  constraint_id?: number;
  entry_type: string;
  is_primary: boolean;
  course?: Course;
  section?: Section;
  room?: Room;
  time_slot?: TimeSlot;
  faculty?: Faculty;
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
  entry_ids: number[];
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  score: number;
  hard_violations: number;
  soft_violations: number;
  issues: ValidationIssue[];
  details?: {
    total_assignments: number;
    by_severity: { hard: number; soft: number };
    by_code: Record<string, number>;
  };
}

export interface GenerationResult {
  timetable_id: number;
  success: boolean;
  message: string;
  validation: ValidationResult;
  assignments_count: number;
  conflicts: Array<{
    type: string;
    message?: string;
    session_a?: Record<string, unknown>;
    session_b?: Record<string, unknown>;
  }>;
}

export interface Analytics {
  total_entries: number;
  faculty_utilization: Record<string, number>;
  room_utilization: Record<string, number>;
  time_slot_utilization: Record<string, number>;
  section_load: Record<string, number>;
  course_frequency: Record<string, number>;
}

export interface TimetableEntryFormatted {
  id: number;
  course: string;
  course_name: string;
  section: string;
  room: string;
  building: string;
  day: number;
  start_time: string;
  end_time: string;
  faculty: string;
  entry_type: string;
}

export type Role = "admin" | "faculty" | "student";

// ---------------------------------------------------------------------------
// Institutional timetable rendering model
// ---------------------------------------------------------------------------

export type TimetableCellType = "CLASS" | "LAB" | "BREAK" | "EMPTY";

export interface BatchAssignment {
  batch: string;
  courseId?: number;
  courseShortCode?: string;
  facultyId?: number;
  facultyInitials?: string;
  roomId?: number;
  roomName?: string;
}

export interface TimetableCell {
  day: string;
  timeSlotId: number;
  type: TimetableCellType;
  courseId?: number;
  courseCode?: string;
  courseShortCode?: string;
  courseName?: string;
  facultyId?: number;
  facultyName?: string;
  facultyInitials?: string;
  roomId?: number;
  roomName?: string;
  roomType?: string;
  sectionId?: number;
  sectionName?: string;
  batch?: "A" | "B" | "ALL";
  batchAssignments?: BatchAssignment[];
  breakLabel?: string;
}

export interface TimetableMetadata {
  universityName?: string;
  departmentName?: string;
  programName?: string;
  semester?: string;
  academicYear?: string;
  sectionName?: string;
  classCoordinator?: string;
  coordinatorPhone?: string;
  totalStudents?: number;
  labBatchCount?: number;
}

export interface TimetableData {
  metadata: TimetableMetadata;
  days: string[];
  timeSlots: TimeSlot[];
  cells: TimetableCell[];
  courses: Course[];
  faculty: Faculty[];
  rooms: Room[];
  sections: Section[];
}
