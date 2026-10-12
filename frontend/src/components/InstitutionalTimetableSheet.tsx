"use client";

import React, { useMemo, useState, useRef } from "react";
import {
  Course,
  Faculty,
  Room,
  Section,
  TimeSlot,
  TimetableEntry,
  TimetableData,
} from "@/lib/types";
import { getFacultyInitials, dayShort, formatSemesterName } from "@/lib/utils";
import { Printer, Download, Layers, CheckCircle2, Sparkles, FileText, ChevronRight, Pencil } from "lucide-react";
import html2canvas from "html2canvas";
import { EditScheduleSlotModal } from "@/components/EditScheduleSlotModal";

export interface InstitutionalTimetableSheetProps {
  timetable?: TimetableData;
  timetableId?: number;
  entries?: any[];
  timeSlots?: any[];
  courses?: any[];
  faculty?: any[];
  rooms?: any[];
  sections?: any[];
  title?: string;
  subtitle?: string;
  showExportButtons?: boolean;
  selectedSection?: string;
  onSectionChange?: (sec: string) => void;
  showSectionTabs?: boolean;
  editable?: boolean;
  onEntrySaved?: () => void;
}

function resolveInitials(name: string | undefined): string {
  if (!name) return "—";
  return getFacultyInitials(name);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TimetableHeader({ metadata }: { metadata?: TimetableData["metadata"] }) {
  if (!metadata) return null;
  const hasContent =
    metadata.universityName ||
    metadata.departmentName ||
    metadata.semester ||
    metadata.academicYear ||
    metadata.classCoordinator ||
    metadata.sectionName;

  if (!hasContent) return null;

  return (
    <div className="text-center mb-3 pb-2 border-b-2 border-slate-800">
      {metadata.universityName && (
        <h2 className="text-lg font-bold uppercase tracking-widest text-slate-900">
          {metadata.universityName}
        </h2>
      )}
      {metadata.departmentName && (
        <p className="text-xs font-semibold text-slate-600 uppercase mt-0.5">
          {metadata.departmentName}
        </p>
      )}
      <div className="mt-1 text-xs text-slate-600 space-y-0.5">
        {metadata.semester && <div>{formatSemesterName(metadata.semester).toUpperCase()}</div>}
        {metadata.academicYear && (
          <div>ACADEMIC YEAR {metadata.academicYear}</div>
        )}
        {(metadata.classCoordinator || metadata.sectionName) && (
          <div>
            {metadata.sectionName && `SECTION: ${metadata.sectionName}`}
            {metadata.classCoordinator &&
              ` | COORDINATOR: ${metadata.classCoordinator}`}
            {metadata.coordinatorPhone &&
              ` | CONTACT: ${metadata.coordinatorPhone}`}
          </div>
        )}
      </div>
    </div>
  );
}

function BreakRow({
  label,
  timeDisplay,
  colSpan,
}: {
  label: string;
  timeDisplay: string;
  colSpan: number;
}) {
  return (
    <tr className="bg-slate-100 border-b border-slate-800 font-bold">
      <td className="border border-slate-800 px-2 py-2 text-slate-500 font-mono text-[11px]">
        —
      </td>
      <td className="border border-slate-800 px-2 py-2 font-semibold text-slate-700 font-mono text-[11px]">
        {timeDisplay}
      </td>
      <td
        colSpan={colSpan}
        className="border border-slate-800 py-2.5 uppercase tracking-widest text-center text-slate-800 bg-slate-200/80 font-bold text-xs"
      >
        {label}
      </td>
    </tr>
  );
}

function ClassCell({
  courseShortCode,
  facultyInitials,
  roomName,
  editable = false,
  onClick,
}: {
  courseShortCode?: string;
  facultyInitials?: string;
  roomName?: string;
  editable?: boolean;
  onClick?: () => void;
}) {
  return (
    <td
      onClick={editable ? onClick : undefined}
      className={`border border-slate-800 px-2 py-2 text-center align-middle bg-white transition group ${
        editable
          ? "cursor-pointer hover:bg-brand-50/80 hover:ring-2 hover:ring-brand-500/50 hover:shadow-xs"
          : ""
      }`}
      title={editable ? "Click to edit timing, faculty, subject, or room" : undefined}
    >
      <div className="font-bold text-slate-900 leading-tight flex items-center justify-center gap-1">
        <span>
          {courseShortCode || "—"}
          {facultyInitials && facultyInitials !== "—"
            ? ` - ${facultyInitials}`
            : ""}
        </span>
        {editable && (
          <Pencil className="h-2.5 w-2.5 text-brand-600 opacity-0 group-hover:opacity-100 transition shrink-0 print:hidden" />
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-700 font-medium mt-0.5">
        {roomName || "—"}
      </div>
    </td>
  );
}

function LabSplitCell({
  assignments,
  editable = false,
  onSelectEntry,
}: {
  assignments: Array<{
    batch: string;
    courseShortCode?: string;
    facultyInitials?: string;
    roomName?: string;
    entry?: any;
  }>;
  editable?: boolean;
  onSelectEntry?: (entry: any) => void;
}) {
  return (
    <td className="border border-slate-800 p-1 bg-slate-200/70 align-top">
      <div className="grid grid-cols-2 gap-1 text-[11px] h-full">
        {assignments.map((a, idx) => (
          <div
            key={idx}
            onClick={editable && a.entry ? () => onSelectEntry?.(a.entry) : undefined}
            className={`border border-slate-400 bg-slate-100 p-1 rounded-sm text-center leading-tight transition ${
              editable && a.entry
                ? "cursor-pointer hover:bg-brand-50 hover:border-brand-500 hover:shadow-xs"
                : ""
            }`}
            title={editable && a.entry ? "Click to edit lab batch timing/faculty/room" : undefined}
          >
            <div className="font-bold text-slate-900 border-b border-slate-300 pb-0.5 mb-0.5 flex items-center justify-center gap-1">
              <span>{a.batch}</span>
              {editable && a.entry && (
                <Pencil className="h-2 w-2 text-brand-600 print:hidden" />
              )}
            </div>
            <div className="font-semibold text-slate-800">
              {a.courseShortCode || "—"}{" "}
              {a.facultyInitials && a.facultyInitials !== "—"
                ? ` - ${a.facultyInitials}`
                : ""}
            </div>
            <div className="text-[10px] text-slate-600 font-mono mt-0.5">
              {a.roomName || "—"}
            </div>
          </div>
        ))}
      </div>
    </td>
  );
}

// ---------------------------------------------------------------------------
// Single Section Sheet Component
// ---------------------------------------------------------------------------

interface SingleSectionSheetProps {
  sectionName?: string;
  entries: any[];
  timeSlots: TimeSlot[];
  courses: Course[];
  faculty: Faculty[];
  rooms: Room[];
  sections: Section[];
  title?: string;
  subtitle?: string;
  metadata?: TimetableData["metadata"];
  showExportButtons?: boolean;
  timetableId?: number;
  editable?: boolean;
  onEntrySaved?: () => void;
}

function SingleSectionSheet({
  sectionName,
  entries,
  timeSlots,
  courses,
  faculty,
  rooms,
  sections,
  title,
  subtitle,
  metadata,
  showExportButtons = true,
  timetableId,
  editable = false,
  onEntrySaved,
}: SingleSectionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [manualEditMode, setManualEditMode] = useState<boolean>(false);
  const [slotModalOpen, setSlotModalOpen] = useState<boolean>(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<number | undefined>(undefined);
  const [selectedDay, setSelectedDay] = useState<number | undefined>(undefined);

  const courseMap = useMemo(
    () => new Map<number, Course>(courses.map((c) => [c.id, c])),
    [courses]
  );
  const facultyMap = useMemo(
    () => new Map<number, Faculty>(faculty.map((f) => [f.id, f])),
    [faculty]
  );
  const roomMap = useMemo(
    () => new Map<number, Room>(rooms.map((r) => [r.id, r])),
    [rooms]
  );
  const sectionMap = useMemo(
    () => new Map<number, Section>(sections.map((s) => [s.id, s])),
    [sections]
  );

  const days: number[] = useMemo(() => {
    const daySet = new Set<number>();
    if (timeSlots?.length) {
      timeSlots.forEach((s) => typeof s.day_of_week === "number" && daySet.add(s.day_of_week));
    }
    if (entries?.length) {
      entries.forEach((e) => {
        if (e.time_slot && typeof e.time_slot.day_of_week === "number") {
          daySet.add(e.time_slot.day_of_week);
        }
      });
    }
    if (daySet.size === 0) {
      [0, 1, 2, 3, 4].forEach((d) => daySet.add(d));
    }
    return Array.from(daySet).sort((a, b) => a - b);
  }, [timeSlots, entries]);

  const uniqueTimeRanges = useMemo(() => {
    const allSlots: TimeSlot[] = [...timeSlots];
    entries.forEach((e) => {
      if (e.time_slot && e.time_slot.start_time && e.time_slot.end_time) {
        allSlots.push(e.time_slot as TimeSlot);
      }
    });

    const timeMap = new Map<string, {
      startTime: string;
      endTime: string;
      label?: string;
      isBreak: boolean;
      slotsByDay: Map<number, TimeSlot>;
    }>();

    allSlots.forEach((slot) => {
      if (!slot.start_time || !slot.end_time) return;
      const startTime = String(slot.start_time).slice(0, 5);
      const endTime = String(slot.end_time).slice(0, 5);
      const key = `${startTime}-${endTime}`;

      if (!timeMap.has(key)) {
        timeMap.set(key, {
          startTime,
          endTime,
          label: slot.label,
          isBreak: !!slot.is_break,
          slotsByDay: new Map<number, TimeSlot>(),
        });
      }

      const item = timeMap.get(key)!;
      if (slot.is_break) {
        item.isBreak = true;
        if (slot.label) item.label = slot.label;
      }
      if (typeof slot.day_of_week === "number") {
        item.slotsByDay.set(slot.day_of_week, slot);
      }
    });

    const result = Array.from(timeMap.values());
    result.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return result;
  }, [timeSlots, entries]);

  const legendCourses = useMemo(() => {
    if (entries.length > 0) {
      const activeIds = Array.from(new Set(entries.map((e) => e.course_id))).filter(Boolean);
      const found = activeIds.map((id) => courseMap.get(id)).filter(Boolean) as Course[];
      if (found.length > 0) return found;
    }
    return courses;
  }, [entries, courses, courseMap]);

  const labPremisesMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    entries.forEach((e) => {
      const c = courseMap.get(e.course_id);
      const r = roomMap.get(e.room_id);
      if ((e.entry_type === "lab" || c?.is_lab) && c && r) {
        const key = c.code || c.name.slice(0, 4).toUpperCase();
        if (!map.has(key)) map.set(key, new Set());
        const roomStr = r.room_number + (r.building ? ` (${r.building})` : "");
        map.get(key)!.add(roomStr);
      }
    });

    if (map.size === 0 && courses.length > 0) {
      const labCourses = courses.filter((c) => c.is_lab || c.code?.toLowerCase().includes("lab"));
      const labRooms = rooms.filter((r) => r.room_type === "lab" || r.has_computer);
      const roomStrList = (labRooms.length > 0 ? labRooms : rooms)
        .map((r) => r.room_number + (r.building ? ` (${r.building})` : ""))
        .join(", ");
      labCourses.forEach((c) => {
        const key = c.code || c.name.slice(0, 4).toUpperCase();
        if (roomStrList) {
          map.set(key, new Set([roomStrList]));
        }
      });
    }

    return map;
  }, [entries, courses, rooms, courseMap, roomMap]);

  const legendFaculty = useMemo(() => {
    if (entries.length > 0) {
      const activeIds = Array.from(new Set(entries.map((e) => e.faculty_id))).filter(Boolean);
      const found = activeIds.map((id) => facultyMap.get(id)).filter(Boolean) as Faculty[];
      if (found.length > 0) return found;
    }
    return faculty;
  }, [entries, faculty, facultyMap]);

  const currentSectionObj = useMemo(() => {
    if (!sectionName) return null;
    return sections.find(
      (s) => String(s.section_number).trim().toUpperCase() === sectionName.trim().toUpperCase()
    );
  }, [sections, sectionName]);

  const totalStudents = useMemo(() => {
    if (currentSectionObj && currentSectionObj.capacity) {
      return currentSectionObj.capacity;
    }
    if (sections && sections.length > 0) {
      return sections[0].capacity || 60;
    }
    return 60;
  }, [currentSectionObj, sections]);

  const labBatchCount = useMemo(() => {
    if (currentSectionObj) {
      const batches = (currentSectionObj as any).batches;
      if (Array.isArray(batches) && batches.length > 0) return batches.length;
      if (currentSectionObj.requires_lab) return 1;
    }
    if (entries.length > 0) {
      const slotCounts = new Map<number, number>();
      entries.filter((e) => e.entry_type === "lab").forEach((e) => {
        slotCounts.set(e.time_slot_id, (slotCounts.get(e.time_slot_id) || 0) + 1);
      });
      const maxConcurrent = Math.max(0, ...Array.from(slotCounts.values()));
      if (maxConcurrent > 0) return maxConcurrent;
    }
    return 0;
  }, [currentSectionObj, entries]);

  const colSpan = days.length > 0 ? days.length : 1;

  const handleExportPNG = async () => {
    if (!sheetRef.current) return;
    try {
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      const secTag = sectionName ? `-section-${sectionName}` : "";
      link.download = `timetable${secTag}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("PNG export failed:", err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="section-sheet-wrapper space-y-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4 print:p-0 print:border-none print:shadow-none">
      {showExportButtons && (
        <div className="flex justify-between items-center print:hidden bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            {sectionName && (
              <span className="px-2.5 py-1 bg-brand-600 text-white font-bold text-xs rounded-md uppercase tracking-wide">
                Section {sectionName}
              </span>
            )}
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">
                {sectionName ? `Section ${sectionName} Timetable Schedule` : "Institutional Timetable Schedule"}
              </h3>
              <p className="text-xs text-slate-500">
                {entries.length} scheduled periods • University Institutional Format
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editable && (
              <button
                type="button"
                onClick={() => setManualEditMode(!manualEditMode)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md shadow flex items-center gap-1.5 transition ${
                  manualEditMode
                    ? "bg-brand-600 text-white hover:bg-brand-700 ring-2 ring-brand-300"
                    : "bg-white text-slate-800 border border-slate-300 hover:bg-slate-100"
                }`}
                title="Click to toggle interactive editing for all timetable slots"
              >
                <Pencil className="h-3.5 w-3.5 text-brand-600" />
                {manualEditMode ? "Exit Edit Mode" : "Edit Manually"}
              </button>
            )}
            <button
              onClick={handleExportPNG}
              className="px-3.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold rounded-md shadow flex items-center gap-1.5 transition"
            >
              <Download className="h-3.5 w-3.5" />
              Download PNG
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold rounded-md shadow flex items-center gap-1.5 transition"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          </div>
        </div>
      )}

      {editable && manualEditMode && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-xs flex items-center justify-between print:hidden shadow-xs">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Manual Editing Active:</strong> Click any scheduled class to modify its Timings, Faculty, Subject, or Classroom. Click any empty slot to assign a class.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setManualEditMode(false)}
            className="text-amber-800 hover:text-amber-950 font-bold underline text-xs shrink-0 ml-3"
          >
            Done Editing
          </button>
        </div>
      )}

      <div
        ref={sheetRef}
        className="institutional-sheet bg-white text-slate-900 font-sans p-4 border border-slate-300 shadow-sm rounded-lg overflow-x-auto print:border-none print:shadow-none print:p-0 print:m-0"
      >
        {(title || subtitle) && (
          <div className="text-center mb-3 pb-2 border-b border-slate-400">
            {title && (
              <h2 className="text-lg font-bold uppercase tracking-wider text-slate-900">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs font-semibold text-slate-700 uppercase">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <TimetableHeader metadata={metadata} />

        <table className="w-full border-collapse border border-slate-800 text-center text-xs">
          <thead>
            <tr className="bg-slate-100 font-bold uppercase text-slate-900 border-b border-slate-800">
              <th className="border border-slate-800 px-2 py-2 w-12 text-center">
                Sr. No.
              </th>
              <th className="border border-slate-800 px-3 py-2 w-32 text-center">
                TIME
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  className="border border-slate-800 px-3 py-2 text-center font-bold"
                >
                  {dayShort(d).toUpperCase()}
                </th>
              ))}
              {days.length === 0 && (
                <th className="border border-slate-800 px-3 py-2 text-center font-bold text-slate-400">
                  DAYS
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {uniqueTimeRanges.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(3, days.length + 2)}
                  className="border border-slate-800 py-8 text-center text-slate-400 italic text-xs bg-white"
                >
                  No time slots configured or matching the selected filters.
                </td>
              </tr>
            ) : (
              uniqueTimeRanges.map((trKey, idx) => {
                const { startTime, endTime, label, isBreak, slotsByDay } = trKey;
                const timeDisplay = `${startTime} - ${endTime}`;

                if (isBreak) {
                  return (
                    <BreakRow
                      key={timeDisplay}
                      label={label || "BREAK"}
                      timeDisplay={timeDisplay}
                      colSpan={colSpan}
                    />
                  );
                }

                const currentSrNo = idx + 1;

                return (
                  <tr key={timeDisplay} className="border-b border-slate-800">
                    <td className="border border-slate-800 px-2 py-2 font-bold text-slate-700 bg-slate-50">
                      {currentSrNo}
                    </td>
                    <td className="border border-slate-800 px-2 py-2 font-semibold text-slate-800 font-mono whitespace-nowrap bg-slate-50">
                      {timeDisplay}
                    </td>
                    {days.map((d) => {
                      const slotForDay = slotsByDay.get(d);
                      const cellEntries = entries.filter((e) => {
                        if (slotForDay && Number(e.time_slot_id) === Number(slotForDay.id)) return true;
                        if (e.time_slot) {
                          const matchDay = Number(e.time_slot.day_of_week) === Number(d);
                          const matchTime = String(e.time_slot.start_time).slice(0, 5) === startTime;
                          return matchDay && matchTime;
                        }
                        return false;
                      });

                      if (cellEntries.length === 0) {
                        return (
                          <td
                            key={d}
                            onClick={
                              editable
                                ? () => {
                                    setSelectedEntry(null);
                                    setSelectedTimeSlotId(slotForDay?.id);
                                    setSelectedDay(d);
                                    setSlotModalOpen(true);
                                  }
                                : undefined
                            }
                            className={`border border-slate-800 px-2 py-3 bg-white transition ${
                              editable
                                ? "cursor-pointer hover:bg-emerald-50/70 hover:shadow-xs group"
                                : ""
                            }`}
                            title={editable ? "Click to assign a class to this empty slot" : undefined}
                          >
                            {editable && (
                              <span className="text-[10px] text-emerald-600 font-semibold opacity-0 group-hover:opacity-100 transition block print:hidden">
                                + Assign
                              </span>
                            )}
                          </td>
                        );
                      }

                      const isLabSlot = cellEntries.some((e) => {
                        const c = e.course || courseMap.get(Number(e.course_id));
                        return e.entry_type === "lab" || c?.is_lab;
                      });

                      if (isLabSlot && cellEntries.length > 1) {
                        const assignments = cellEntries.map((e, idx) => {
                          const c = e.course || courseMap.get(Number(e.course_id));
                          const f = e.faculty || facultyMap.get(Number(e.faculty_id));
                          const r = e.room || roomMap.get(Number(e.room_id));
                          const batchLabel = String.fromCharCode(65 + idx);
                          return {
                            batch: batchLabel,
                            courseShortCode: c?.code || c?.name?.slice(0, 5),
                            facultyInitials: resolveInitials(f?.name),
                            roomName: r?.room_number || r?.building,
                            entry: e,
                          };
                        });
                        return (
                          <LabSplitCell
                            key={d}
                            assignments={assignments}
                            editable={editable}
                            onSelectEntry={(entryObj) => {
                              setSelectedEntry(entryObj);
                              setSelectedTimeSlotId(slotForDay?.id || entryObj.time_slot_id);
                              setSelectedDay(d);
                              setSlotModalOpen(true);
                            }}
                          />
                        );
                      }

                      const e = cellEntries[0];
                      const c = e.course || courseMap.get(Number(e.course_id));
                      const f = e.faculty || facultyMap.get(Number(e.faculty_id));
                      const r = e.room || roomMap.get(Number(e.room_id));
                      const initials = resolveInitials(f?.name);
                      const courseAbbr = c?.code || c?.name?.slice(0, 6);

                      return (
                        <ClassCell
                          key={d}
                          courseShortCode={courseAbbr}
                          facultyInitials={initials}
                          roomName={r?.room_number || r?.building}
                          editable={editable}
                          onClick={() => {
                            setSelectedEntry(e);
                            setSelectedTimeSlotId(slotForDay?.id || e.time_slot_id);
                            setSelectedDay(d);
                            setSlotModalOpen(true);
                          }}
                        />
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="mt-4 border border-slate-800 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800 text-xs">
            <div>
              <div className="bg-slate-200 font-bold px-2 py-1.5 text-center border-b border-slate-800 uppercase tracking-wide">
                SUBJECT NAMES AND CODES
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-semibold text-[10px] text-slate-700 border-b border-slate-400">
                      <th className="p-1 border-r border-slate-300">CODE</th>
                      <th className="p-1 border-r border-slate-300">ABBR</th>
                      <th className="p-1">SUBJECT NAME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legendCourses.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-slate-200 text-[11px]"
                      >
                        <td className="p-1 border-r border-slate-300 font-mono font-semibold">
                          {c.code}
                        </td>
                        <td className="p-1 border-r border-slate-300 font-medium">
                          {c.code.slice(0, 5)}
                        </td>
                        <td className="p-1 text-slate-800">{c.name}</td>
                      </tr>
                    ))}
                    {legendCourses.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-3 text-center text-slate-400 italic text-[11px]"
                        >
                          No subjects selected
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="bg-slate-200 font-bold px-2 py-1.5 text-center border-b border-slate-800 uppercase tracking-wide">
                LAB PREMISES
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-semibold text-[10px] text-slate-700 border-b border-slate-400">
                      <th className="p-1 border-r border-slate-300 w-1/3">
                        LAB
                      </th>
                      <th className="p-1">ROOM / PREMISES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(labPremisesMap.entries()).map(
                      ([labName, roomSet]) => (
                        <tr
                          key={labName}
                          className="border-b border-slate-200 text-[11px]"
                        >
                          <td className="p-1 border-r border-slate-300 font-bold text-slate-800">
                            {labName}
                          </td>
                          <td className="p-1 font-mono text-slate-700">
                            {Array.from(roomSet).join(", ")}
                          </td>
                        </tr>
                      )
                    )}
                    {labPremisesMap.size === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="p-3 text-center text-slate-400 italic text-[11px]"
                        >
                          No specific lab premises mapped
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="bg-slate-200 font-bold px-2 py-1.5 text-center border-b border-slate-800 uppercase tracking-wide">
                FACULTY INITIALS AND NAMES
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-semibold text-[10px] text-slate-700 border-b border-slate-400">
                      <th className="p-1 border-r border-slate-300 w-1/4 text-center">
                        INITIALS
                      </th>
                      <th className="p-1">FACULTY NAME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legendFaculty.map((f) => (
                      <tr
                        key={f.id}
                        className="border-b border-slate-200 text-[11px]"
                      >
                        <td className="p-1 border-r border-slate-300 font-bold text-center text-slate-900 font-mono">
                          {resolveInitials(f.name)}
                        </td>
                        <td className="p-1 text-slate-800">{f.name}</td>
                      </tr>
                    ))}
                    {legendFaculty.length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="p-3 text-center text-slate-400 italic text-[11px]"
                        >
                          No faculty selected
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-slate-100 border-t border-slate-800 px-3 py-1.5 flex justify-between items-center text-xs font-bold text-slate-900">
            <div>TOTAL STUDENTS: {totalStudents !== null ? totalStudents : "—"}</div>
            <div>LAB BATCH: {labBatchCount > 0 ? String(labBatchCount).padStart(2, "0") : "—"}</div>
          </div>
        </div>
      </div>

      <EditScheduleSlotModal
        open={slotModalOpen}
        onClose={() => {
          setSlotModalOpen(false);
          setSelectedEntry(null);
        }}
        timetableId={timetableId}
        entry={selectedEntry}
        timeSlotId={selectedTimeSlotId}
        dayOfWeek={selectedDay}
        sectionName={sectionName}
        courses={courses}
        faculty={faculty}
        rooms={rooms}
        timeSlots={timeSlots}
        sections={sections}
        onSaved={onEntrySaved}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main InstitutionalTimetableSheet Component (Multi-Section Orchestrator)
// ---------------------------------------------------------------------------

export function InstitutionalTimetableSheet({
  timetable,
  timetableId: timetableIdProp,
  entries: entriesProp,
  timeSlots: timeSlotsProp,
  courses: coursesProp,
  faculty: facultyProp,
  rooms: roomsProp,
  sections: sectionsProp,
  title,
  subtitle,
  showExportButtons = true,
  selectedSection: selectedSectionProp,
  onSectionChange,
  showSectionTabs = true,
  editable = false,
  onEntrySaved,
}: InstitutionalTimetableSheetProps) {
  const activeTimetableId = timetableIdProp ?? timetable?.id;
  const metadata = timetable?.metadata ?? {};

  const courses: Course[] = timetable?.courses ?? (coursesProp ?? []);
  const faculty: Faculty[] = timetable?.faculty ?? (facultyProp ?? []);
  const rooms: Room[] = timetable?.rooms ?? (roomsProp ?? []);
  const sections: Section[] = timetable?.sections ?? (sectionsProp ?? []);
  const timeSlots: TimeSlot[] = timetable?.timeSlots ?? (timeSlotsProp ?? []);

  const entries = useMemo(() => {
    if (timetable?.cells) {
      return timetable.cells.map((c) => ({
        id: 0,
        timetable_id: 0,
        course_id: c.courseId ?? 0,
        section_id: c.sectionId ?? 0,
        room_id: c.roomId ?? 0,
        time_slot_id: c.timeSlotId,
        faculty_id: c.facultyId ?? 0,
        entry_type: c.type === "LAB" ? "lab" : "class",
        is_primary: true,
        course: c.courseCode
          ? ({ code: c.courseCode, name: c.courseName } as Course)
          : undefined,
        section: c.sectionName
          ? ({ section_number: c.sectionName } as Section)
          : undefined,
        room: c.roomName ? ({ room_number: c.roomName } as Room) : undefined,
        time_slot: c.day
          ? ({ day_of_week: 0, start_time: "", end_time: "" } as TimeSlot)
          : undefined,
        faculty: c.facultyName
          ? ({ name: c.facultyName } as Faculty)
          : undefined,
      }));
    }
    return entriesProp ?? [];
  }, [timetable?.cells, entriesProp]);

  const sectionMap = useMemo(
    () => new Map<number, Section>(sections.map((s) => [s.id, s])),
    [sections]
  );

  // Group entries by Section
  const sectionsData = useMemo(() => {
    const map = new Map<string, any[]>();
    entries.forEach((e) => {
      let secName = "";
      if (typeof e.section === "string") {
        secName = e.section;
      } else if (e.section?.section_number) {
        secName = e.section.section_number;
      } else if (e.section_name) {
        secName = e.section_name;
      } else if (e.section_id && sectionMap.has(Number(e.section_id))) {
        secName = sectionMap.get(Number(e.section_id))!.section_number;
      } else {
        secName = "A";
      }
      secName = String(secName).trim().toUpperCase();
      if (!map.has(secName)) {
        map.set(secName, []);
      }
      map.get(secName)!.push(e);
    });

    const sortedSecNames = Array.from(map.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );

    return sortedSecNames.map((name) => ({
      name,
      entries: map.get(name)!,
    }));
  }, [entries, sectionMap]);

  // Active section tab state (controlled by prop if provided, else internal)
  const [internalActiveSection, setInternalActiveSection] = useState<string>("ALL");
  const activeSection = selectedSectionProp !== undefined ? selectedSectionProp : internalActiveSection;

  const handleTabClick = (sec: string) => {
    if (onSectionChange) {
      onSectionChange(sec);
    } else {
      setInternalActiveSection(sec);
    }
  };

  const handlePrintAll = () => {
    window.print();
  };

  // Base Department and Semester text
  const deptTitle = useMemo(() => {
    if (metadata.departmentName) return metadata.departmentName;
    return "Department";
  }, [metadata.departmentName]);

  const semText = useMemo(() => {
    if (metadata.semester) return formatSemesterName(metadata.semester);
    return "";
  }, [metadata.semester]);

  // If there are multiple sections present
  if (sectionsData.length > 1) {
    const isShowingAll = activeSection === "ALL";
    const filteredSections = isShowingAll
      ? sectionsData
      : sectionsData.filter((s) => s.name.toUpperCase() === activeSection.toUpperCase());

    return (
      <div className="space-y-6">
        {/* Multi-Section Switcher Tabs */}
        {showSectionTabs && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 print:hidden flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mr-1">
                <Layers className="h-4 w-4 text-brand-600" />
                Section Schedules:
              </span>
              <button
                type="button"
                onClick={() => handleTabClick("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  isShowingAll
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                All Sections ({sectionsData.length} Sheets)
              </button>
              {sectionsData.map((sec) => (
                <button
                  key={sec.name}
                  type="button"
                  onClick={() => handleTabClick(sec.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeSection.toUpperCase() === sec.name.toUpperCase()
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  Section {sec.name} ({sec.entries.length} slots)
                </button>
              ))}
            </div>

            {isShowingAll && showExportButtons && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintAll}
                  className="px-3.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold rounded-md shadow flex items-center gap-1.5 transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print All Section Sheets
                </button>
              </div>
            )}
          </div>
        )}

        {/* Section Sheets */}
        <div className="space-y-8">
          {(filteredSections.length > 0 ? filteredSections : sectionsData).map((sec) => {
            const secSubtitle = subtitle
              ? subtitle.replace(/• Section [A-Z0-9]+/i, "").replace(/• All Generated Sections \([^)]+\)/i, "") + ` • SECTION ${sec.name}`
              : `${deptTitle} • ${semText} • SECTION ${sec.name}`;

            const secMeta = {
              ...metadata,
              sectionName: sec.name,
            };

            return (
              <div key={sec.name} className="section-sheet-container print:page-break-after-always">
                <SingleSectionSheet
                  sectionName={sec.name}
                  entries={sec.entries}
                  timeSlots={timeSlots}
                  courses={courses}
                  faculty={faculty}
                  rooms={rooms}
                  sections={sections}
                  title={title || "OFFICIAL INSTITUTIONAL TIMETABLE SCHEDULE"}
                  subtitle={secSubtitle}
                  metadata={secMeta}
                  showExportButtons={showExportButtons}
                  timetableId={activeTimetableId}
                  editable={editable}
                  onEntrySaved={onEntrySaved}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Single section fallback (either 0 or 1 section in entries)
  const singleSectionName = sectionsData.length === 1 ? sectionsData[0].name : metadata.sectionName;
  const singleEntries = sectionsData.length === 1 ? sectionsData[0].entries : entries;

  return (
    <SingleSectionSheet
      sectionName={singleSectionName}
      entries={singleEntries}
      timeSlots={timeSlots}
      courses={courses}
      faculty={faculty}
      rooms={rooms}
      sections={sections}
      title={title || "OFFICIAL INSTITUTIONAL TIMETABLE SCHEDULE"}
      subtitle={subtitle}
      metadata={metadata}
      showExportButtons={showExportButtons}
      timetableId={activeTimetableId}
      editable={editable}
      onEntrySaved={onEntrySaved}
    />
  );
}
