"use client";

import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Trash2,
  Clock,
  BookOpen,
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Layers,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import {
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
} from "@/lib/api";
import { Course, Faculty, Room, Section, TimeSlot } from "@/lib/types";
import { dayName, formatTime } from "@/lib/utils";

export interface EditScheduleSlotModalProps {
  open: boolean;
  onClose: () => void;
  timetableId?: number;
  entry?: any; // Existing entry object or null
  dayOfWeek?: number;
  timeSlotId?: number;
  timeSlotLabel?: string;
  sectionId?: number;
  sectionName?: string;
  courses: Course[];
  faculty: Faculty[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  sections: Section[];
  entries?: any[]; // All current timetable entries for conflict checking
  onSaved?: () => void;
}

export function EditScheduleSlotModal({
  open,
  onClose,
  timetableId,
  entry,
  dayOfWeek,
  timeSlotId,
  timeSlotLabel,
  sectionId,
  sectionName,
  courses,
  faculty,
  rooms,
  timeSlots,
  sections,
  entries: entriesProp,
  onSaved,
}: EditScheduleSlotModalProps) {
  const toast = useToast();
  const qc = useQueryClient();

  const isEditing = Boolean(entry && entry.id);

  // Form states
  const [selectedSectionNumber, setSelectedSectionNumber] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<number | "">("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | "">("");
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | "">("");
  const [selectedRoomId, setSelectedRoomId] = useState<number | "">("");
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<number | "">("");
  const [entryType, setEntryType] = useState<string>("class");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Get all entries for cross-section and cross-slot conflict checking
  const allEntries = useMemo(() => {
    if (entriesProp && entriesProp.length > 0) return entriesProp;
    if (timetableId) {
      const cached = qc.getQueryData<any[]>(["timetable-entries", timetableId]);
      if (cached && Array.isArray(cached)) return cached;
      const cachedTt = qc.getQueryData<any>(["timetable", timetableId]);
      if (cachedTt?.entries && Array.isArray(cachedTt.entries)) return cachedTt.entries;
    }
    return [];
  }, [entriesProp, timetableId, qc]);

  // Distinct section numbers available
  const availableSectionOptions = useMemo(() => {
    const secSet = new Set<string>();

    // 1. From sections list
    sections.forEach((s) => {
      if (s.section_number) {
        secSet.add(String(s.section_number).trim().toUpperCase());
      }
    });

    // 2. From all timetable entries
    (allEntries || []).forEach((e: any) => {
      const sNum =
        typeof e.section === "string"
          ? e.section
          : e.section?.section_number || e.section_name;
      if (sNum) secSet.add(String(sNum).trim().toUpperCase());
    });

    // 3. From current props / entry
    if (sectionName) secSet.add(String(sectionName).trim().toUpperCase());
    if (entry) {
      const eNum =
        typeof entry.section === "string"
          ? entry.section
          : entry.section?.section_number || entry.section_name;
      if (eNum) secSet.add(String(eNum).trim().toUpperCase());
    }

    if (secSet.size === 0) {
      secSet.add("A");
      secSet.add("B");
    }

    return Array.from(secSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [sections, allEntries, sectionName, entry]);

  // Filter non-break time slots and sort by day + time
  const validTimeSlots = useMemo(() => {
    return timeSlots
      .filter((s) => !s.is_break)
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return String(a.start_time).localeCompare(String(b.start_time));
      });
  }, [timeSlots]);

  // Initialize or reset form state when modal opens or entry changes
  useEffect(() => {
    setError(null);
    if (!open) return;

    if (entry) {
      const initSec =
        typeof entry.section === "string"
          ? entry.section
          : entry.section?.section_number || entry.section_name || sectionName || "A";
      const cleanSec = String(initSec).trim().toUpperCase();
      setSelectedSectionNumber(cleanSec);
      setSelectedSectionId(entry.section_id ?? "");
      setSelectedCourseId(entry.course_id ?? "");
      setSelectedFacultyId(entry.faculty_id ?? "");
      setSelectedRoomId(entry.room_id ?? "");
      setSelectedTimeSlotId(entry.time_slot_id ?? timeSlotId ?? "");
      setEntryType(entry.entry_type || "class");
    } else {
      const initSec = sectionName || availableSectionOptions[0] || "A";
      const cleanSec = String(initSec).trim().toUpperCase();
      setSelectedSectionNumber(cleanSec);

      const matchedSec = sections.find(
        (s) => String(s.section_number).trim().toUpperCase() === cleanSec
      );
      setSelectedSectionId(matchedSec?.id ?? (sectionId || ""));
      setSelectedCourseId(courses[0]?.id ?? "");
      setSelectedFacultyId(faculty[0]?.id ?? "");
      setSelectedRoomId(rooms[0]?.id ?? "");
      setSelectedTimeSlotId(timeSlotId ?? validTimeSlots[0]?.id ?? "");
      setEntryType("class");
    }
  }, [
    open,
    entry,
    timeSlotId,
    sectionId,
    sectionName,
    courses,
    faculty,
    rooms,
    validTimeSlots,
    availableSectionOptions,
    sections,
  ]);

  // When section changes
  const handleSectionChange = (secNum: string) => {
    setSelectedSectionNumber(secNum);
    const match =
      sections.find(
        (s) =>
          String(s.section_number).trim().toUpperCase() === secNum.trim().toUpperCase() &&
          (!selectedCourseId || s.course_id === Number(selectedCourseId))
      ) ||
      sections.find(
        (s) => String(s.section_number).trim().toUpperCase() === secNum.trim().toUpperCase()
      );
    if (match) {
      setSelectedSectionId(match.id);
    }
  };

  // When course changes, if faculty has not been explicitly changed, suggest course's default faculty
  const handleCourseChange = (courseIdVal: number) => {
    setSelectedCourseId(courseIdVal);
    const chosenCourse = courses.find((c) => c.id === courseIdVal);
    if (chosenCourse?.faculty_id) {
      setSelectedFacultyId(chosenCourse.faculty_id);
    }
    if (chosenCourse?.is_lab) {
      setEntryType("lab");
      const labRoom = rooms.find((r) => r.room_type === "lab" || r.has_computer);
      if (labRoom) setSelectedRoomId(labRoom.id);
    }

    // Update section id for new course if available
    if (selectedSectionNumber) {
      const match = sections.find(
        (s) =>
          s.course_id === courseIdVal &&
          String(s.section_number).trim().toUpperCase() === selectedSectionNumber.trim().toUpperCase()
      );
      if (match) setSelectedSectionId(match.id);
    }
  };

  // Real-time conflict analysis
  const activeConflicts = useMemo(() => {
    if (!selectedTimeSlotId) return [];
    const conflicts: { type: "section" | "faculty" | "room" | "break"; message: string }[] = [];

    // Check if break slot
    const slotObj = timeSlots.find((ts) => ts.id === Number(selectedTimeSlotId));
    if (slotObj?.is_break) {
      conflicts.push({
        type: "break",
        message: `This time slot is designated as a break (${slotObj.label || "Break"}). Classes cannot be scheduled here.`,
      });
    }

    if (!allEntries || allEntries.length === 0) return conflicts;

    const otherEntries = allEntries.filter((e: any) => {
      if (entry?.id && (e.id === entry.id || e === entry)) return false;
      return Number(e.time_slot_id) === Number(selectedTimeSlotId);
    });

    // 1. Check Section conflict
    if (selectedSectionNumber) {
      const sectionClash = otherEntries.find((e: any) => {
        const secNum =
          typeof e.section === "string"
            ? e.section
            : e.section?.section_number || e.section_name;
        if (String(secNum).trim().toUpperCase() === selectedSectionNumber.trim().toUpperCase()) {
          const isCurrentLab = entryType === "lab";
          const isOtherLab = e.entry_type === "lab";
          if (isCurrentLab && isOtherLab && Number(e.course_id) === Number(selectedCourseId)) {
            return false;
          }
          return true;
        }
        return false;
      });

      if (sectionClash) {
        const cObj = courses.find((c) => c.id === Number(sectionClash.course_id));
        const cName = cObj ? `${cObj.code} (${cObj.name})` : "another course";
        conflicts.push({
          type: "section",
          message: `Section ${selectedSectionNumber} already has ${cName} scheduled at this time.`,
        });
      }
    }

    // 2. Check Faculty conflict
    if (selectedFacultyId) {
      const facClash = otherEntries.find((e: any) => Number(e.faculty_id) === Number(selectedFacultyId));
      if (facClash) {
        const fObj = faculty.find((f) => f.id === Number(selectedFacultyId));
        const cObj = courses.find((c) => c.id === Number(facClash.course_id));
        const secNum =
          typeof facClash.section === "string"
            ? facClash.section
            : facClash.section?.section_number || facClash.section_name || "another section";
        conflicts.push({
          type: "faculty",
          message: `${fObj?.name || "Selected faculty"} is already teaching Section ${secNum} (${cObj?.code || "class"}) at this time.`,
        });
      }
    }

    // 3. Check Room conflict
    if (selectedRoomId) {
      const roomClash = otherEntries.find((e: any) => Number(e.room_id) === Number(selectedRoomId));
      if (roomClash) {
        const rObj = rooms.find((r) => r.id === Number(selectedRoomId));
        const secNum =
          typeof roomClash.section === "string"
            ? roomClash.section
            : roomClash.section?.section_number || roomClash.section_name || "another section";
        conflicts.push({
          type: "room",
          message: `Room ${rObj?.room_number || "Selected room"} is already occupied by Section ${secNum} at this time.`,
        });
      }
    }

    return conflicts;
  }, [
    selectedTimeSlotId,
    selectedSectionNumber,
    selectedFacultyId,
    selectedRoomId,
    selectedCourseId,
    entryType,
    entry,
    allEntries,
    timeSlots,
    courses,
    faculty,
    rooms,
  ]);

  const sectionConflict = activeConflicts.find((c) => c.type === "section");
  const facultyConflict = activeConflicts.find((c) => c.type === "faculty");
  const roomConflict = activeConflicts.find((c) => c.type === "room");
  const breakConflict = activeConflicts.find((c) => c.type === "break");
  const hasConflicts = activeConflicts.length > 0;

  const handleSave = async () => {
    if (!timetableId) {
      setError("No timetable reference ID available.");
      return;
    }
    if (!selectedSectionNumber) {
      setError("Please select a section.");
      return;
    }
    if (!selectedCourseId) {
      setError("Please select a course/subject.");
      return;
    }
    if (!selectedFacultyId) {
      setError("Please select a faculty member.");
      return;
    }
    if (!selectedRoomId) {
      setError("Please select a classroom or lab.");
      return;
    }
    if (!selectedTimeSlotId) {
      setError("Please select a timing slot.");
      return;
    }
    if (hasConflicts) {
      setError(`Cannot save due to conflicts: ${activeConflicts.map((c) => c.message).join(" ")}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Resolve target section_id
    let targetSecId = selectedSectionId ? Number(selectedSectionId) : undefined;
    if (
      !targetSecId ||
      (selectedCourseId &&
        sections.some((s) => s.id === targetSecId && s.course_id !== Number(selectedCourseId)))
    ) {
      const courseSpecificSec = sections.find(
        (s) =>
          s.course_id === Number(selectedCourseId) &&
          String(s.section_number).trim().toUpperCase() === selectedSectionNumber.trim().toUpperCase()
      );
      if (courseSpecificSec) {
        targetSecId = courseSpecificSec.id;
      }
    }
    if (!targetSecId) {
      const anySec = sections.find(
        (s) => String(s.section_number).trim().toUpperCase() === selectedSectionNumber.trim().toUpperCase()
      );
      if (anySec) targetSecId = anySec.id;
    }
    if (!targetSecId && entry?.section_id) {
      targetSecId = Number(entry.section_id);
    }

    try {
      const payload = {
        course_id: Number(selectedCourseId),
        faculty_id: Number(selectedFacultyId),
        room_id: Number(selectedRoomId),
        time_slot_id: Number(selectedTimeSlotId),
        section_id: targetSecId,
        section_name: selectedSectionNumber,
        entry_type: entryType,
      };

      if (isEditing) {
        await updateTimetableEntry(timetableId, entry.id, payload);
        toast.success(`Schedule slot updated successfully for Section ${selectedSectionNumber}!`);
      } else {
        await createTimetableEntry(timetableId, payload);
        toast.success(`Class assigned successfully to Section ${selectedSectionNumber}!`);
      }

      await qc.invalidateQueries({ queryKey: ["timetable-entries", timetableId] });
      await qc.invalidateQueries({ queryKey: ["timetable", timetableId] });
      await qc.invalidateQueries({ queryKey: ["timetables"] });
      await qc.invalidateQueries({ queryKey: ["analytics", timetableId] });

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error("Save entry failed:", err);
      setError(
        err?.response?.data?.detail ||
          "Failed to save schedule changes. Please check for conflicting slots."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!timetableId || !entry?.id) return;

    if (!confirm("Are you sure you want to remove this class from the schedule?")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await deleteTimetableEntry(timetableId, entry.id);
      toast.success("Class removed from schedule.");

      await qc.invalidateQueries({ queryKey: ["timetable-entries", timetableId] });
      await qc.invalidateQueries({ queryKey: ["timetable", timetableId] });
      await qc.invalidateQueries({ queryKey: ["timetables"] });
      await qc.invalidateQueries({ queryKey: ["analytics", timetableId] });

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error("Delete entry failed:", err);
      setError(err?.response?.data?.detail || "Failed to remove slot from schedule.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEditing
          ? `Edit Schedule Slot — Section ${selectedSectionNumber || sectionName || ""}`
          : `Assign Class — Section ${selectedSectionNumber || sectionName || ""}`
      }
      size="md"
    >
      <div className="space-y-4">
        {/* Helper subtitle */}
        <p className="text-xs text-ink-500">
          Customize the section, timing, faculty, subject, or classroom for this slot. All manual changes validate conflict-free before applying to the schedule.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {hasConflicts && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              Scheduling Conflict Detected:
            </div>
            <ul className="list-disc pl-5 space-y-1 text-amber-800 text-[11px]">
              {activeConflicts.map((c, i) => (
                <li key={i}>{c.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3.5">
          {/* 1. TIMINGS / TIME SLOT */}
          <div>
            <label className="label flex items-center justify-between text-ink-900 font-bold">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-brand-600" />
                1. Timings &amp; Day
              </span>
            </label>
            <select
              className={`select-field text-xs font-semibold ${
                breakConflict ? "border-red-400 bg-red-50/40" : ""
              }`}
              value={selectedTimeSlotId}
              onChange={(e) => setSelectedTimeSlotId(Number(e.target.value))}
            >
              <option value="">— Select Time Slot —</option>
              {validTimeSlots.map((ts) => {
                const sTime = String(ts.start_time).slice(0, 5);
                const eTime = String(ts.end_time).slice(0, 5);
                const dayStr = dayName(ts.day_of_week);
                return (
                  <option key={ts.id} value={ts.id}>
                    {dayStr}: {sTime} - {eTime} {ts.label ? `(${ts.label})` : ""}
                  </option>
                );
              })}
            </select>
            {breakConflict && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {breakConflict.message}
              </p>
            )}
          </div>

          {/* 2. SECTION SELECTION */}
          <div>
            <label className="label flex items-center justify-between text-ink-900 font-bold">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-brand-600" />
                2. Section / Cohort
              </span>
              {selectedSectionNumber && (
                <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                  Section {selectedSectionNumber}
                </span>
              )}
            </label>
            <select
              className={`select-field text-xs font-semibold ${
                sectionConflict ? "border-red-400 bg-red-50/40 focus:border-red-500" : ""
              }`}
              value={selectedSectionNumber}
              onChange={(e) => handleSectionChange(e.target.value)}
            >
              <option value="">— Select Section —</option>
              {availableSectionOptions.map((secNum) => (
                <option key={secNum} value={secNum}>
                  Section {secNum}
                </option>
              ))}
            </select>
            {sectionConflict && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {sectionConflict.message}
              </p>
            )}
          </div>

          {/* 3. SUBJECT / COURSE */}
          <div>
            <label className="label flex items-center gap-1.5 text-ink-900 font-bold">
              <BookOpen className="h-3.5 w-3.5 text-brand-600" />
              3. Subject / Course
            </label>
            <select
              className="select-field text-xs"
              value={selectedCourseId}
              onChange={(e) => handleCourseChange(Number(e.target.value))}
            >
              <option value="">— Select Subject —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name} {c.is_lab ? "[Lab]" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 4. FACULTY */}
          <div>
            <label className="label flex items-center gap-1.5 text-ink-900 font-bold">
              <Users className="h-3.5 w-3.5 text-brand-600" />
              4. Faculty / Instructor
            </label>
            <select
              className={`select-field text-xs ${
                facultyConflict ? "border-red-400 bg-red-50/40 focus:border-red-500" : ""
              }`}
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(Number(e.target.value))}
            >
              <option value="">— Select Faculty —</option>
              {faculty.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.initials ? `(${f.initials})` : ""} {f.department ? `— ${f.department}` : ""}
                </option>
              ))}
            </select>
            {facultyConflict && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {facultyConflict.message}
              </p>
            )}
          </div>

          {/* 5. CLASSROOM / LAB */}
          <div>
            <label className="label flex items-center gap-1.5 text-ink-900 font-bold">
              <Building2 className="h-3.5 w-3.5 text-brand-600" />
              5. Classroom / Lab Room
            </label>
            <select
              className={`select-field text-xs ${
                roomConflict ? "border-red-400 bg-red-50/40 focus:border-red-500" : ""
              }`}
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(Number(e.target.value))}
            >
              <option value="">— Select Room —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.room_number} {r.building ? `(${r.building})` : ""} — {r.room_type || "Lecture"} (Cap: {r.capacity})
                </option>
              ))}
            </select>
            {roomConflict && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {roomConflict.message}
              </p>
            )}
          </div>

          {/* 6. SESSION TYPE */}
          <div>
            <label className="label text-[11px] text-ink-600 font-medium">
              6. Session Type
            </label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs text-ink-800 cursor-pointer">
                <input
                  type="radio"
                  name="entryType"
                  value="class"
                  checked={entryType === "class"}
                  onChange={() => setEntryType("class")}
                  className="text-brand-600 focus:ring-brand-500"
                />
                Theory / Lecture
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-ink-800 cursor-pointer">
                <input
                  type="radio"
                  name="entryType"
                  value="lab"
                  checked={entryType === "lab"}
                  onChange={() => setEntryType("lab")}
                  className="text-brand-600 focus:ring-brand-500"
                />
                Practical / Lab Session
              </label>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-ink-100 gap-2">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="btn-secondary text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 inline-flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
              {isDeleting ? "Removing..." : "Remove Slot"}
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || isDeleting || hasConflicts}
              className={`btn-primary text-xs inline-flex items-center gap-1.5 ${
                hasConflicts
                  ? "bg-amber-600 hover:bg-amber-700 opacity-60 cursor-not-allowed"
                  : "bg-brand-600 hover:bg-brand-700"
              }`}
              title={hasConflicts ? "Please resolve conflicts before saving" : undefined}
            >
              <Save className="h-3.5 w-3.5" />
              {isSubmitting
                ? "Saving Changes..."
                : hasConflicts
                ? "Resolve Conflicts to Save"
                : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
