"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState, SuccessState, ErrorState } from "@/components/States";
import { InstitutionalTimetableSheet } from "@/components/InstitutionalTimetableSheet";
import { useToast } from "@/components/Toast";
import {
  generateTimetable,
  getDepartments,
  getSemesters,
  getCourses,
  getFaculty,
  getRooms,
  getTimeSlots,
  getSections,
  getTimetableEntries,
  getTimetable,
} from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  Users,
  Building2,
  Clock,
  CalendarRange,
  Filter,
  Play,
  ArrowLeft,
  Layers,
  Save,
  Eye,
  Download,
  Printer,
} from "lucide-react";
import { dayShort, dayName } from "@/lib/utils";
import { Course, Faculty, Room, Section, TimeSlot } from "@/lib/types";

// --- Types ---
interface DepartmentItem {
  id: number;
  name: string;
  code?: string;
  description?: string;
}

interface SemesterData {
  semester: string;
  label: string;
}

interface CourseItem {
  id: number;
  code: string;
  name: string;
  is_lab: boolean;
  department_id?: number;
  semester?: string;
  faculty_id?: number;
  faculty?: { id: number; name: string; department?: string };
}

interface SectionItem {
  id: number;
  section_number: string;
}

interface FacultyItem {
  id: number;
  name: string;
  initials?: string;
  department?: string;
  department_id?: number;
  is_full_time: boolean;
}

interface RoomItem {
  id: number;
  room_number: string;
  building?: string;
  capacity: number;
  room_type: string;
}

interface TimeSlotItem {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
}

interface GenResult {
  timetable_id: number;
  success: boolean;
  message: string;
  assignments_count: number;
  validation: { score: number; hard_violations: number; soft_violations: number; valid: boolean };
  filter_summary?: {
    courses_count?: number;
    sections_count?: number;
    faculty_count?: number;
    rooms_count?: number;
    time_slots_count?: number;
    department?: string;
    department_id?: number;
    semester?: string | number;
  };
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// --- Time helpers ---
function formatTo12Hour(time24: string): string {
  if (!time24) return "";
  const parts = time24.split(":");
  if (parts.length < 2) return time24;
  let h = parseInt(parts[0], 10);
  const m = parts[1].padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h.toString().padStart(2, "0")}:${m} ${period}`;
}

function parseTo12HourParts(time24: string, defaultPeriod: "AM" | "PM" = "AM") {
  if (!time24) return { hour: defaultPeriod === "AM" ? 8 : 5, minute: 0, period: defaultPeriod };
  const parts = time24.split(":");
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return { hour: h, minute: m, period: period as "AM" | "PM" };
}

function to24Hour(hour: number, minute: number, period: "AM" | "PM"): string {
  let h = hour % 12;
  if (period === "PM") h += 12;
  return `${h.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

interface TimePicker12HourProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  defaultPeriod?: "AM" | "PM";
  presets?: string[];
}

function TimePicker12Hour({
  label,
  value,
  onChange,
  placeholder = "Select time",
  defaultPeriod = "AM",
  presets = [],
}: TimePicker12HourProps) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseTo12HourParts(value, defaultPeriod), [value, defaultPeriod]);
  const [selectedHour, setSelectedHour] = useState<number>(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState<number>(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(parsed.period);

  useEffect(() => {
    if (value) {
      const p = parseTo12HourParts(value, defaultPeriod);
      setSelectedHour(p.hour);
      setSelectedMinute(p.minute);
      setSelectedPeriod(p.period);
    }
  }, [value, defaultPeriod]);

  const updateTime = (h: number, m: number, p: "AM" | "PM") => {
    setSelectedHour(h);
    setSelectedMinute(m);
    setSelectedPeriod(p);
    onChange(to24Hour(h, m, p));
  };

  const handleHourChange = (h: number) => {
    updateTime(h, selectedMinute, selectedPeriod);
  };

  const handleMinuteChange = (m: number) => {
    updateTime(selectedHour, m, selectedPeriod);
  };

  const handlePeriodChange = (p: "AM" | "PM") => {
    updateTime(selectedHour, selectedMinute, p);
  };

  const formattedDisplay = value ? formatTo12Hour(value) : "";

  return (
    <div className="relative">
      <span className="text-xs font-semibold text-ink-600 block mb-1">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input-field text-left flex items-center justify-between group hover:border-brand-500 focus:border-brand-500 transition shadow-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 text-brand-600 shrink-0" />
          <span className={formattedDisplay ? "text-ink-900 font-bold tracking-wide text-sm truncate" : "text-ink-400 text-sm truncate"}>
            {formattedDisplay || placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {value && (
            <span
              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                parsed.period === "AM" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
              }`}
            >
              {parsed.period}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />}
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1.5 w-72 bg-white border border-ink-200 rounded-2xl shadow-2xl p-4 space-y-4 animate-in fade-in zoom-in-95 duration-100 left-0">
            <div className="flex items-center justify-between pb-2 border-b border-ink-100">
              <span className="text-xs font-bold text-ink-700 uppercase tracking-wider">{label}</span>
              <span className="text-sm font-extrabold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200">
                {formatTo12Hour(to24Hour(selectedHour, selectedMinute, selectedPeriod))}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <label className="text-[11px] font-bold text-ink-500 uppercase block mb-1">Hour</label>
                <select
                  value={selectedHour}
                  onChange={(e) => handleHourChange(Number(e.target.value))}
                  className="w-full text-center font-bold text-sm bg-ink-50 hover:bg-ink-100 border border-ink-200 rounded-xl py-2 px-1 focus:ring-2 focus:ring-brand-500 outline-none transition cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      {h.toString().padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink-500 uppercase block mb-1">Minute</label>
                <select
                  value={selectedMinute}
                  onChange={(e) => handleMinuteChange(Number(e.target.value))}
                  className="w-full text-center font-bold text-sm bg-ink-50 hover:bg-ink-100 border border-ink-200 rounded-xl py-2 px-1 focus:ring-2 focus:ring-brand-500 outline-none transition cursor-pointer"
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <option key={m} value={m}>
                      {m.toString().padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink-500 uppercase block mb-1">AM / PM</label>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => handlePeriodChange("AM")}
                    className={`text-xs font-extrabold py-1 rounded-lg transition-all border ${
                      selectedPeriod === "AM"
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-ink-50 text-ink-600 border-ink-200 hover:bg-ink-100"
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeriodChange("PM")}
                    className={`text-xs font-extrabold py-1 rounded-lg transition-all border ${
                      selectedPeriod === "PM"
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-ink-50 text-ink-600 border-ink-200 hover:bg-ink-100"
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            {presets.length > 0 && (
              <div className="pt-2 border-t border-ink-100">
                <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wide block mb-1.5">
                  Quick Select
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {presets.map((pTime) => {
                    const label12 = formatTo12Hour(pTime);
                    const isSelected = value === pTime;
                    return (
                      <button
                        key={pTime}
                        type="button"
                        onClick={() => {
                          const p = parseTo12HourParts(pTime, defaultPeriod);
                          updateTime(p.hour, p.minute, p.period);
                        }}
                        className={`text-[11px] font-semibold py-1 px-1.5 rounded-lg border text-center transition ${
                          isSelected
                            ? "bg-brand-50 border-brand-500 text-brand-700 font-bold shadow-xs"
                            : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
                        }`}
                      >
                        {label12}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-ink-100">
              {value ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Clear
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-primary text-xs py-1.5 px-3 rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Multi-Select Component ---
function MultiSelect<T extends { id: number; name: string }>({
  label,
  items,
  selected,
  onChange,
  placeholder,
  disabled = false,
  emptyText = "No items available",
  renderItem,
}: {
  label: string;
  items: T[];
  selected: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
  disabled?: boolean;
  emptyText?: string;
  renderItem?: (item: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: number) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };
  const selectedNames = items.filter((i) => selected.includes(i.id)).map((i) => i.name);

  return (
    <div className="relative">
      <label className="label">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`input-field text-left flex items-center justify-between ${
          disabled ? "bg-ink-100/60 cursor-not-allowed opacity-75" : ""
        }`}
      >
        <span className={selected.length ? "text-ink-900 font-medium" : "text-ink-400"}>
          {selected.length ? selectedNames.join(", ") : placeholder}
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-ink-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 cursor-pointer transition text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggle(item.id)}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              {renderItem ? renderItem(item) : <span className="text-ink-900">{item.name}</span>}
            </label>
          ))}
          {items.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-500">{emptyText}</p>
          )}
        </div>
      )}
      {selected.length > 0 && !disabled && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-1 text-xs text-red-500 hover:text-red-700"
        >
          Clear all ({selected.length})
        </button>
      )}
    </div>
  );
}

// --- Main Generate Page ---
export default function GeneratePage() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  // Cascading form state
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | "">("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<number[]>([]);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [numSections, setNumSections] = useState<number>(0);
  const [numRooms, setNumRooms] = useState<number>(0);
  const [optimize, setOptimize] = useState(true);
  const [maxIterations, setMaxIterations] = useState(1000);

  // Phase: form | validating | generating | success | error
  type Phase = "form" | "validating" | "generating" | "success" | "error";
  const [phase, setPhase] = useState<Phase>("form");
  const [result, setResult] = useState<GenResult | null>(null);
  const [generatedId, setGeneratedId] = useState<number | null>(null);

  // 1. Department Query: Authoritative database departments
  const { data: departmentsData, isLoading: isLoadingDepts } = useQuery({
    queryKey: ["departments"],
    queryFn: () => getDepartments().then((r) => r.data),
  });

  // 2. Semester Query: Dependent on selected Department
  const { data: semestersData, isLoading: isLoadingSemesters } = useQuery({
    queryKey: ["semesters", selectedDepartmentId],
    queryFn: () => getSemesters(selectedDepartmentId).then((r) => r.data),
    enabled: Boolean(selectedDepartmentId),
  });

  // 3. Courses Query: Dependent on BOTH Department and Semester (backend filtered)
  const { data: coursesData, isLoading: isLoadingCourses } = useQuery({
    queryKey: ["courses", selectedDepartmentId, selectedSemester],
    queryFn: () =>
      getCourses({
        department_id: Number(selectedDepartmentId),
        semester: selectedSemester,
        limit: 500,
      }).then((r) => r.data),
    enabled: Boolean(selectedDepartmentId && selectedSemester),
  });

  // 4. Faculty Query: Dependent on Department, Semester, and selected Courses
  const { data: facultyData, isLoading: isLoadingFaculty } = useQuery({
    queryKey: ["faculty", selectedDepartmentId, selectedSemester, selectedCourses],
    queryFn: () =>
      getFaculty({
        department_id: selectedDepartmentId ? Number(selectedDepartmentId) : undefined,
        semester: selectedSemester || undefined,
        course_ids: selectedCourses.length ? selectedCourses.join(",") : undefined,
        limit: 200,
      }).then((r) => r.data),
    enabled: Boolean(selectedDepartmentId),
  });

  // 5. Lookup Queries for Rooms, TimeSlots, and Sections
  const { data: roomsData } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => getRooms({ limit: 200 }).then((r) => r.data),
  });
  const { data: timeSlotsData } = useQuery({
    queryKey: ["time-slots"],
    queryFn: () => getTimeSlots({ limit: 300 }).then((r) => r.data),
  });
  const { data: sectionsData } = useQuery({
    queryKey: ["sections"],
    queryFn: () => getSections({ limit: 200 }).then((r) => r.data),
  });

  const departments: DepartmentItem[] = Array.isArray(departmentsData) ? departmentsData : [];
  const semesters: SemesterData[] = Array.isArray(semestersData) ? semestersData : [];
  const courses: CourseItem[] = Array.isArray(coursesData) ? coursesData : [];
  const faculties: FacultyItem[] = Array.isArray(facultyData) ? facultyData : [];
  const rooms: RoomItem[] = Array.isArray(roomsData) ? roomsData : [];
  const timeSlots: TimeSlotItem[] = Array.isArray(timeSlotsData) ? timeSlotsData : [];
  const sections: SectionItem[] = Array.isArray(sectionsData) ? sectionsData : [];

  // Selected Department Object
  const currentDepartmentObj = useMemo(
    () => departments.find((d) => d.id === selectedDepartmentId),
    [departments, selectedDepartmentId]
  );
  const currentDepartmentName = currentDepartmentObj?.name || "";

  // Reset cascades on Department change
  const handleDepartmentChange = (deptIdVal: string) => {
    const newDeptId = deptIdVal ? Number(deptIdVal) : "";
    setSelectedDepartmentId(newDeptId);
    setSelectedSemester("");
    setSelectedCourses([]);
    setSelectedFaculty([]);
  };

  // Reset cascades on Semester change
  const handleSemesterChange = (semVal: string) => {
    setSelectedSemester(semVal);
    setSelectedCourses([]);
    setSelectedFaculty([]);
  };

  // Reset/filter faculty when selected courses change
  const handleCoursesChange = (newSelectedCourseIds: number[]) => {
    setSelectedCourses(newSelectedCourseIds);
    if (newSelectedCourseIds.length === 0) {
      setSelectedFaculty([]);
    } else {
      // Keep only selected faculty who teach the newly selected courses
      const validFacultyIds = new Set<number>();
      newSelectedCourseIds.forEach((cId) => {
        const courseObj = courses.find((c) => c.id === cId);
        if (courseObj?.faculty_id) {
          validFacultyIds.add(courseObj.faculty_id);
        }
      });
      setSelectedFaculty((prev) => prev.filter((fId) => validFacultyIds.has(fId)));
    }
  };

  // Generate mutation
  const gen = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: `${currentDepartmentName || "Department"} - Semester ${selectedSemester || ""}`,
        optimize,
        max_iterations: maxIterations,
      };
      if (selectedDepartmentId) {
        payload.department_id = selectedDepartmentId;
        payload.department = currentDepartmentName;
      }
      if (selectedSemester) {
        payload.semester = selectedSemester;
      }
      if (selectedCourses.length) payload.courses = selectedCourses;
      if (timeStart) payload.time_start = timeStart;
      if (timeEnd) payload.time_end = timeEnd;
      if (selectedFaculty.length) payload.faculty = selectedFaculty;
      if (numSections > 0) payload.num_sections = numSections;
      if (numRooms > 0) payload.num_rooms = numRooms;
      return generateTimetable(payload as any);
    },
    onSuccess: (res) => {
      const data = res.data as GenResult;
      setResult(data);
      setGeneratedId(data.timetable_id);
      setPhase("success");
      if (data.success) {
        toast.success("Timetable generated successfully!");
      } else {
        toast.warning("Timetable generated with violations");
      }
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      setPhase("error");
      toast.error("Generation failed");
    },
  });

  const handleGenerate = () => {
    if (!isConfigurationReady) {
      toast.error("Please complete all required configuration fields before generating.");
      setPhase("validating");
      return;
    }
    setPhase("generating");
    setResult(null);
    gen.mutate();
  };

  // Validate before generation without running solver
  const handleValidate = () => {
    setPhase("validating");
  };

  // Fetch entries after successful generation
  const { data: entriesData } = useQuery({
    queryKey: ["timetable-entries", generatedId],
    queryFn: () => getTimetableEntries(generatedId!).then((r) => r.data),
    enabled: !!generatedId && phase === "success",
  });

  // Check if user has entered any input
  const hasAnyInput = Boolean(
    selectedDepartmentId !== "" ||
    selectedSemester !== "" ||
    selectedCourses.length > 0 ||
    selectedFaculty.length > 0 ||
    timeStart ||
    timeEnd ||
    numSections > 0 ||
    numRooms > 0
  );

  // Check if ALL required fields are complete
  const isConfigurationReady = Boolean(
    selectedDepartmentId !== "" &&
    selectedSemester !== "" &&
    selectedCourses.length > 0 &&
    selectedFaculty.length > 0 &&
    timeStart &&
    timeEnd &&
    numSections > 0 &&
    numRooms > 0
  );

  // Required field checks for validation status and missing field reporting
  const requiredFieldChecks = useMemo(() => [
    {
      id: "department",
      label: "Department",
      ready: Boolean(selectedDepartmentId !== ""),
      value: currentDepartmentName || "Not selected",
    },
    {
      id: "semester",
      label: "Semester",
      ready: Boolean(selectedSemester !== ""),
      value: selectedSemester || "Not selected",
    },
    {
      id: "courses",
      label: "Subjects (Courses)",
      ready: selectedCourses.length > 0,
      value: selectedCourses.length > 0 ? `${selectedCourses.length} selected` : "None selected",
    },
    {
      id: "time",
      label: "Subject Period Time",
      ready: Boolean(timeStart && timeEnd),
      value: timeStart && timeEnd
        ? `${formatTo12Hour(timeStart)} – ${formatTo12Hour(timeEnd)}`
        : (timeStart ? `From ${formatTo12Hour(timeStart)}` : (timeEnd ? `Until ${formatTo12Hour(timeEnd)}` : "Not configured")),
    },
    {
      id: "faculty",
      label: "Faculty",
      ready: selectedFaculty.length > 0,
      value: selectedFaculty.length > 0 ? `${selectedFaculty.length} selected` : "None selected",
    },
    {
      id: "sections",
      label: "Number of Sections",
      ready: numSections > 0,
      value: numSections > 0 ? `${numSections} section(s)` : "Not configured",
    },
    {
      id: "rooms",
      label: "Number of Required Rooms",
      ready: numRooms > 0,
      value: numRooms > 0 ? `${numRooms} room(s)` : "Not configured",
    },
  ], [selectedDepartmentId, currentDepartmentName, selectedSemester, selectedCourses, timeStart, timeEnd, selectedFaculty, numSections, numRooms]);

  const missingFields = useMemo(
    () => requiredFieldChecks.filter((c) => !c.ready),
    [requiredFieldChecks]
  );

  // Preview timetable data (strictly derived from selected form data, only when configuration is ready)
  const previewTimetableData = useMemo(() => {
    if (!isConfigurationReady) {
      return {
        metadata: {},
        courses: [],
        faculty: [],
        rooms: [],
        sections: [],
        timeSlots: [],
        entries: [],
      };
    }

    // 1. Selected courses: only what the user explicitly selected
    const selectedCourseObjs = selectedCourses
      .map((id) => courses.find((c) => c.id === id))
      .filter(Boolean) as CourseItem[];

    // 2. Selected faculty: only what the user explicitly selected
    const selectedFacultyObjs = selectedFaculty
      .map((id) => faculties.find((f) => f.id === id))
      .filter(Boolean) as FacultyItem[];

    // 3. Selected rooms: strictly limited to numRooms
    const selectedRoomObjs = rooms.slice(0, numRooms);

    // 4. Selected sections: sections matching selected courses, sliced to numSections
    const selectedCourseIds = new Set(selectedCourses);
    let matchedSections = sections.filter((s: any) => selectedCourseIds.has(s.course_id));
    if (matchedSections.length === 0) {
      matchedSections = sections;
    }
    const selectedSectionObjs = matchedSections.slice(0, numSections);

    // 5. Filter time slots by configured timeStart and timeEnd
    let filteredTimeSlots = timeSlots;
    if (timeStart) {
      filteredTimeSlots = filteredTimeSlots.filter(
        (ts) => String(ts.start_time).slice(0, 5) >= timeStart
      );
    }
    if (timeEnd) {
      filteredTimeSlots = filteredTimeSlots.filter(
        (ts) => String(ts.end_time).slice(0, 5) <= timeEnd
      );
    }

    const metadata = {
      universityName: undefined,
      departmentName: currentDepartmentName ? currentDepartmentName.toUpperCase() : undefined,
      semester: selectedSemester ? `SEMESTER ${selectedSemester}` : undefined,
      academicYear: undefined,
      classCoordinator: undefined,
      coordinatorPhone: undefined,
    };

    return {
      metadata,
      courses: selectedCourseObjs,
      faculty: selectedFacultyObjs,
      rooms: selectedRoomObjs,
      sections: selectedSectionObjs,
      timeSlots: filteredTimeSlots,
      entries: [], // Empty before generation
    };
  }, [
    isConfigurationReady,
    currentDepartmentName,
    selectedSemester,
    selectedCourses,
    selectedFaculty,
    numSections,
    numRooms,
    courses,
    faculties,
    rooms,
    sections,
    timeSlots,
    timeStart,
    timeEnd,
  ]);

  const handleReset = () => {
    setPhase("form");
    setResult(null);
    setGeneratedId(null);
    setSelectedDepartmentId("");
    setSelectedSemester("");
    setSelectedCourses([]);
    setSelectedFaculty([]);
    setTimeStart("");
    setTimeEnd("");
    setNumSections(0);
    setNumRooms(0);
  };

  const handleViewTimetable = () => {
    if (generatedId) router.push(`/admin/timetables/${generatedId}`);
  };

  const scoreColor = (s: number) => {
    if (s >= 80) return "text-emerald-600";
    if (s >= 60) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <AppShell>
      <PageHeader
        title="Generate Timetable"
        description="Configure academic parameters and generate your conflict-free schedule"
        icon={<Wand2 className="h-5 w-5" />}
      />

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Selection Form */}
        {phase === "form" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
                <Filter className="h-5 w-5 text-brand-600" />
                Data-Driven Generation Options
              </h2>
              <span className="text-xs font-medium text-ink-500 bg-ink-100 px-2.5 py-1 rounded-full">
                Source: timetable.xlsx
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. DEPARTMENT DROPDOWN */}
              <div>
                <label className="label">1. Department</label>
                <select
                  className="select-field"
                  value={selectedDepartmentId}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  disabled={isLoadingDepts}
                >
                  {isLoadingDepts ? (
                    <option value="">Loading departments...</option>
                  ) : departments.length === 0 ? (
                    <option value="">No departments available</option>
                  ) : (
                    <>
                      <option value="">— Select Department —</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* 2. SEMESTER DROPDOWN */}
              <div>
                <label className="label">2. Semester</label>
                <select
                  className="select-field"
                  value={selectedSemester}
                  onChange={(e) => handleSemesterChange(e.target.value)}
                  disabled={!selectedDepartmentId || isLoadingSemesters}
                >
                  {!selectedDepartmentId ? (
                    <option value="">Select department first</option>
                  ) : isLoadingSemesters ? (
                    <option value="">Loading semesters...</option>
                  ) : semesters.length === 0 ? (
                    <option value="">No semesters available</option>
                  ) : (
                    <>
                      <option value="">— Select Semester —</option>
                      {semesters.map((s) => (
                        <option key={s.semester} value={s.semester}>
                          {s.label || s.semester}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* 3. SUBJECTS (COURSES) MULTI-SELECT */}
              <div className="md:col-span-2">
                <MultiSelect<{ id: number; name: string }>
                  label="3. Subjects (Courses)"
                  items={courses.map((c) => ({
                    id: c.id,
                    name: `${c.code} — ${c.name}${c.is_lab ? " (Lab)" : ""}`,
                  }))}
                  selected={selectedCourses}
                  onChange={handleCoursesChange}
                  disabled={!selectedDepartmentId || !selectedSemester || isLoadingCourses}
                  placeholder={
                    !selectedDepartmentId || !selectedSemester
                      ? "Select department and semester first"
                      : isLoadingCourses
                      ? "Loading subjects..."
                      : courses.length === 0
                      ? "No subjects available for this department and semester"
                      : "Select subjects..."
                  }
                  emptyText="No subjects available for this department and semester"
                />
              </div>

              {/* 4. SUBJECT PERIOD TIME */}
              <div>
                <label className="label">4. Subject Period Time (AM / PM)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TimePicker12Hour
                    label="Start Time"
                    value={timeStart}
                    onChange={setTimeStart}
                    placeholder="Select Start (e.g. 08:00 AM)"
                    defaultPeriod="AM"
                    presets={["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]}
                  />
                  <TimePicker12Hour
                    label="End Time"
                    value={timeEnd}
                    onChange={setTimeEnd}
                    placeholder="Select End (e.g. 05:00 PM)"
                    defaultPeriod="PM"
                    presets={["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"]}
                  />
                </div>
              </div>

              {/* 5. FACULTY MULTI-SELECT */}
              <div className="md:col-span-2">
                <MultiSelect<{ id: number; name: string }>
                  label="5. Faculty"
                  items={faculties.map((f) => ({
                    id: f.id,
                    name: `${f.name}${f.initials ? ` (${f.initials})` : ""}${f.department ? ` — ${f.department}` : (currentDepartmentName ? ` — ${currentDepartmentName}` : "")}`,
                  }))}
                  selected={selectedFaculty}
                  onChange={setSelectedFaculty}
                  disabled={!selectedDepartmentId || isLoadingFaculty}
                  placeholder={
                    !selectedDepartmentId
                      ? "Select department first"
                      : isLoadingFaculty
                      ? "Loading faculty..."
                      : faculties.length === 0
                      ? "No faculty members found"
                      : "Select faculty members..."
                  }
                  emptyText="No faculty members found"
                />
              </div>

              {/* 6. NUMBER OF SECTIONS */}
              <div>
                <label className="label">6. Number of Sections</label>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={numSections || ""}
                  onChange={(e) => setNumSections(Number(e.target.value) || 0)}
                  placeholder="e.g. 4"
                />
              </div>

              {/* 7. NUMBER OF REQUIRED ROOMS */}
              <div>
                <label className="label">7. Number of Required Rooms</label>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={numRooms || ""}
                  onChange={(e) => setNumRooms(Number(e.target.value) || 0)}
                  placeholder="e.g. 3"
                />
              </div>
            </div>

            <div className="border-t border-ink-100 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-ink-900">Algorithm Settings</h3>
              <div className="flex items-center justify-between p-3 rounded-xl bg-ink-50 border border-ink-100">
                <div>
                  <p className="text-sm font-medium text-ink-900">Optimization</p>
                  <p className="text-xs text-ink-500">Enable constraint-aware DSATUR graph coloring optimization</p>
                </div>
                <button
                  onClick={() => setOptimize(!optimize)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${optimize ? "bg-brand-600" : "bg-ink-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${optimize ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <div>
                <label className="label">Max Iterations: {maxIterations}</label>
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={100}
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleValidate}
                disabled={gen.isPending}
                className="btn-secondary flex-1 text-base py-3"
              >
                <Eye className="h-5 w-5" />
                Preview &amp; Validate Configuration
              </button>
              <button
                onClick={handleGenerate}
                disabled={gen.isPending}
                className="btn-primary flex-1 text-base py-3"
              >
                {gen.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    Generate Timetable
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Validating State */}
        {phase === "validating" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`card border-2 p-6 space-y-4 ${isConfigurationReady ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isConfigurationReady ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                )}
                <div>
                  <h3 className={`font-bold text-base ${isConfigurationReady ? "text-emerald-900" : "text-amber-900"}`}>
                    {isConfigurationReady ? "Configuration Valid & Ready" : "Configuration Incomplete"}
                  </h3>
                  <p className={`text-xs ${isConfigurationReady ? "text-emerald-700" : "text-amber-700"}`}>
                    {isConfigurationReady
                      ? "All required fields are configured. Review the data-driven timetable preview below and proceed to generation."
                      : "Please provide all required configuration inputs before generating the timetable schedule."}
                  </p>
                </div>
              </div>
              <button onClick={() => setPhase("form")} className="btn-secondary text-xs">
                Back to Form
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink-700 uppercase tracking-wide">
                Validation Checklist:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {requiredFieldChecks.map((field) => (
                  <div
                    key={field.id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                      field.ready
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-red-50 border-red-200 text-red-800 font-medium"
                    }`}
                  >
                    {field.ready ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="font-semibold">{field.label}:</span>{" "}
                      <span className="truncate opacity-90">{field.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!isConfigurationReady && (
              <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-lg text-xs text-amber-900">
                <span className="font-bold">Missing {missingFields.length} required field(s):</span>{" "}
                {missingFields.map((f) => f.label).join(", ")}.
              </div>
            )}
          </motion.div>
        )}

        {/* Pre-Generation Institutional Timetable Preview (Visible in form & validating states) */}
        {(phase === "form" || phase === "validating") && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-brand-600" />
                  Institutional Timetable Template Preview
                </h3>
                <p className="text-xs text-ink-500">
                  {isConfigurationReady
                    ? "Live data-driven template preview reflecting your configured department, subjects, period times, and faculty."
                    : hasAnyInput
                    ? "Complete the required timetable configuration to preview the timetable."
                    : "Select the required timetable options to preview your timetable."}
                </p>
              </div>
              <span
                className={`badge ${
                  isConfigurationReady
                    ? "badge-success"
                    : hasAnyInput
                    ? "badge-warning"
                    : "badge-neutral"
                }`}
              >
                {isConfigurationReady
                  ? "Data-Driven Preview"
                  : hasAnyInput
                  ? "Configuration Incomplete"
                  : "No Configuration Selected"}
              </span>
            </div>

            {/* STATE 1: No input selected */}
            {!hasAnyInput && (
              <div className="text-center py-12 px-6 border-2 border-dashed border-ink-200 rounded-2xl bg-ink-50/50 space-y-3">
                <div className="h-12 w-12 mx-auto rounded-xl bg-ink-100 text-ink-500 flex items-center justify-center">
                  <CalendarRange className="h-6 w-6" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h4 className="text-base font-bold text-ink-900">
                    No Configuration Selected
                  </h4>
                  <p className="text-xs text-ink-500">
                    Select the required timetable options to preview your timetable.
                  </p>
                </div>
              </div>
            )}

            {/* STATE 2: Incomplete input */}
            {hasAnyInput && !isConfigurationReady && (
              <div className="py-8 px-6 border-2 border-dashed border-amber-200 rounded-2xl bg-amber-50/40 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-amber-900">
                      Configuration Incomplete
                    </h4>
                    <p className="text-xs text-amber-700">
                      Complete the required timetable configuration to preview the timetable.
                    </p>
                  </div>
                </div>

                <div className="bg-white/90 border border-amber-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-ink-700 uppercase tracking-wide">
                    Required Timetable Configuration Checklist:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    {requiredFieldChecks.map((field) => (
                      <div
                        key={field.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border ${
                          field.ready
                            ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                            : "bg-red-50/70 border-red-200 text-red-800"
                        }`}
                      >
                        {field.ready ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="font-semibold">{field.label}:</span>{" "}
                          <span className="truncate opacity-80">{field.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STATE 3: Complete configuration available */}
            {isConfigurationReady && (
              <div className="overflow-x-auto">
                <InstitutionalTimetableSheet
                  entries={[]}
                  timeSlots={previewTimetableData.timeSlots}
                  courses={previewTimetableData.courses}
                  faculty={previewTimetableData.faculty}
                  rooms={previewTimetableData.rooms}
                  sections={previewTimetableData.sections}
                  title={`DEPARTMENT OF ${currentDepartmentName ? currentDepartmentName.toUpperCase() : "ACADEMICS"}`}
                  subtitle={`${selectedSemester ? selectedSemester.toUpperCase() : ""} • PRE-GENERATION PREVIEW`}
                  showExportButtons={false}
                />
              </div>
            )}
          </motion.div>
        )}

        {/* Generating State */}
        <AnimatePresence>
          {phase === "generating" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card border-brand-200 bg-brand-50 p-6">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="h-5 w-5 text-brand-600 animate-spin" />
                <h3 className="font-semibold text-brand-700">Scheduling in progress...</h3>
              </div>
              <div className="space-y-2 text-sm text-brand-700">
                <p>✓ Building conflict graph</p>
                <p>✓ Running DSATUR coloring algorithm</p>
                <p>✓ Applying constraint rules</p>
                <p>↻ Validating solution quality</p>
              </div>
            </motion.div>
          )}

          {/* Success State */}
          {phase === "success" && result && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className={`card border-2 ${result.validation.valid ? "border-emerald-200" : "border-amber-200"}`}>
                <div className="flex items-start gap-4">
                  {result.validation.valid ? (
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0 mt-1" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0 mt-1" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-ink-900 mb-1">
                      {result.validation.valid ? "Timetable Generated Successfully" : "Generated with Violations"}
                    </h3>
                    <p className="text-sm text-ink-600">{result.message}</p>
                    <div className="mt-3 flex items-center gap-4 flex-wrap">
                      <div>
                        <p className="text-xs text-ink-500">Assignments</p>
                        <p className="text-xl font-bold text-ink-900">{result.assignments_count}</p>
                      </div>
                      <div className="h-10 border-l border-ink-200" />
                      <div>
                        <p className="text-xs text-ink-500">Quality Score</p>
                        <p className={`text-xl font-bold ${scoreColor(result.validation.score)}`}>
                          {result.validation.score.toFixed(1)}%
                        </p>
                      </div>
                      <div className="h-10 border-l border-ink-200" />
                      <div>
                        <p className="text-xs text-ink-500">Hard Violations</p>
                        <p className="text-xl font-bold text-red-600">{result.validation.hard_violations}</p>
                      </div>
                      <div className="h-10 border-l border-ink-200" />
                      <div>
                        <p className="text-xs text-ink-500">Soft Violations</p>
                        <p className="text-xl font-bold text-amber-600">{result.validation.soft_violations}</p>
                      </div>
                    </div>
                    {result.filter_summary && (
                      <div className="mt-3 p-3 rounded-lg bg-ink-50 border border-ink-100 text-xs text-ink-600">
                        <strong>Filters applied:</strong> Courses: {result.filter_summary.courses_count} | Sections: {result.filter_summary.sections_count} | Faculty: {result.filter_summary.faculty_count} | Rooms: {result.filter_summary.rooms_count} | Time Slots: {result.filter_summary.time_slots_count}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Generated Institutional Timetable */}
              <div className="card p-4 overflow-hidden">
                <InstitutionalTimetableSheet
                  entries={entriesData ?? []}
                  timeSlots={timeSlots}
                  courses={courses}
                  faculty={faculties}
                  rooms={rooms}
                  sections={sections}
                  title="Official Institutional Timetable Schedule"
                  subtitle={currentDepartmentName ? `Department: ${currentDepartmentName} • Semester ${selectedSemester || ""}` : "Generated Schedule"}
                  showExportButtons={true}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                <button onClick={handleReset} className="btn-secondary">
                  Generate Again
                </button>
                <button onClick={handleViewTimetable} className="btn-primary">
                  <ArrowRight className="h-4 w-4" /> View Full Timetable
                </button>
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {phase === "error" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <ErrorState title="Generation Failed" message="An error occurred while generating the timetable." onRetry={() => setPhase("form")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
