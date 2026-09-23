"use client";

import React, { useMemo } from "react";
import {
  Course,
  Faculty,
  Room,
  Section,
  TimeSlot,
  TimetableEntry,
  TimetableData,
} from "@/lib/types";
import { getFacultyInitials, dayShort } from "@/lib/utils";
import { Printer, Download } from "lucide-react";
import html2canvas from "html2canvas";

interface InstitutionalTimetableSheetProps {
  timetable?: TimetableData;
  entries?: any[];
  timeSlots?: any[];
  courses?: any[];
  faculty?: any[];
  rooms?: any[];
  sections?: any[];
  title?: string;
  subtitle?: string;
  showExportButtons?: boolean;
}

function resolveInitials(name: string | undefined): string {
  if (!name) return "—";
  return getFacultyInitials(name);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TimetableHeader({ metadata }: { metadata: TimetableData["metadata"] }) {
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
        {metadata.semester && <div>SEMESTER {metadata.semester}</div>}
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
}: {
  courseShortCode?: string;
  facultyInitials?: string;
  roomName?: string;
}) {
  return (
    <td className="border border-slate-800 px-2 py-2 text-center align-middle bg-white">
      <div className="font-bold text-slate-900 leading-tight">
        {courseShortCode || "—"}
        {facultyInitials && facultyInitials !== "—"
          ? ` - ${facultyInitials}`
          : ""}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-700 font-medium mt-0.5">
        {roomName || "—"}
      </div>
    </td>
  );
}

function LabSplitCell({
  assignments,
}: {
  assignments: Array<{
    batch: string;
    courseShortCode?: string;
    facultyInitials?: string;
    roomName?: string;
  }>;
}) {
  return (
    <td className="border border-slate-800 p-1 bg-slate-200/70 align-top">
      <div className="grid grid-cols-2 gap-1 text-[11px] h-full">
        {assignments.map((a, idx) => (
          <div
            key={idx}
            className="border border-slate-400 bg-slate-100 p-1 rounded-sm text-center leading-tight"
          >
            <div className="font-bold text-slate-900 border-b border-slate-300 pb-0.5 mb-0.5">
              {a.batch}
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
// Main component
// ---------------------------------------------------------------------------

export function InstitutionalTimetableSheet({
  timetable,
  entries: entriesProp,
  timeSlots: timeSlotsProp,
  courses: coursesProp,
  faculty: facultyProp,
  rooms: roomsProp,
  sections: sectionsProp,
  title,
  subtitle,
  showExportButtons = true,
}: InstitutionalTimetableSheetProps) {
  const metadata = timetable?.metadata ?? {};

  const courses: Course[] = timetable?.courses ?? (coursesProp ?? []);
  const faculty: Faculty[] = timetable?.faculty ?? (facultyProp ?? []);
  const rooms: Room[] = timetable?.rooms ?? (roomsProp ?? []);
  const sections: Section[] = timetable?.sections ?? (sectionsProp ?? []);
  const timeSlots: TimeSlot[] = timetable?.timeSlots ?? (timeSlotsProp ?? []);

  const entries = timetable?.cells
    ? timetable.cells.map((c) => ({
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
      }))
    : entriesProp ?? [];

  const days: number[] = useMemo(() => {
    const daySet = new Set<number>();
    if (timetable?.days?.length) {
      timetable.days.forEach((d) => typeof d === "number" && daySet.add(d));
    }
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
    const arr = Array.from(daySet).sort((a, b) => a - b);
    return arr;
  }, [timetable?.days, timeSlots, entries]);

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

  const totalStudents = useMemo(() => {
    if (!sections || sections.length === 0) return null;
    const sum = sections.reduce(
      (acc, s) => acc + (s.capacity || s.current_enrollment || 0),
      0
    );
    return sum > 0 ? sum : null;
  }, [sections]);

  const labBatchCount = useMemo(() => {
    if (sections && sections.length > 0) {
      const labSections = sections.filter(
        (s) => s.requires_lab || (s as any).is_lab || (s as any).batches?.length > 0
      );
      if (labSections.length > 0) {
        const totalBatches = labSections.reduce((acc, s) => {
          const batches = (s as any).batches;
          if (Array.isArray(batches) && batches.length > 0) {
            return acc + batches.length;
          }
          return acc + 1;
        }, 0);
        return totalBatches > 0 ? totalBatches : 0;
      }
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
  }, [sections, entries]);

  const colSpan = days.length > 0 ? days.length : 1;
  const sheetRef = React.useRef<HTMLDivElement>(null);

  const handleExportPNG = async () => {
    if (!sheetRef.current) return;
    try {
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `timetable-${Date.now()}.png`;
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
    <div className="space-y-4">
      {showExportButtons && (
        <div className="flex justify-between items-center print:hidden bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">
              Institutional Sheet View
            </h3>
            <p className="text-xs text-slate-500">
              Official university format with legend tables &amp; break rows
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPNG}
              className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold rounded-md shadow flex items-center gap-2 transition"
            >
              <Download className="h-4 w-4" />
              Download PNG
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold rounded-md shadow flex items-center gap-2 transition"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
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
              <p className="text-xs font-medium text-slate-600 uppercase">
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
                          className="border border-slate-800 px-2 py-3 bg-white"
                        />
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
                          courseCode: c?.code || c?.name?.slice(0, 5),
                          courseName: c?.name,
                          facultyInitials: resolveInitials(f?.name),
                          roomName: r?.room_number || r?.building,
                        };
                      });
                      return (
                        <LabSplitCell key={d} assignments={assignments} />
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
                      />
                    );
                  })}
                </tr>
              );
            }))}
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
    </div>
  );
}
