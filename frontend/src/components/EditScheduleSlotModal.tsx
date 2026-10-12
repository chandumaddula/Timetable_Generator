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
  onSaved,
}: EditScheduleSlotModalProps) {
  const toast = useToast();
  const qc = useQueryClient();

  const isEditing = Boolean(entry && entry.id);

  // Form states
  const [selectedCourseId, setSelectedCourseId] = useState<number | "">("");
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | "">("");
  const [selectedRoomId, setSelectedRoomId] = useState<number | "">("");
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<number | "">("");
  const [entryType, setEntryType] = useState<string>("class");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter non-break time slots and sort by day + time
  const validTimeSlots = useMemo(() => {
    return timeSlots
      .filter((s) => !s.is_break)
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return String(a.start_time).localeCompare(String(b.start_time));
      });
  }, [timeSlots]);

  // Target Section ID
  const targetSectionId = useMemo(() => {
    if (entry?.section_id) return Number(entry.section_id);
    if (sectionId) return Number(sectionId);
    if (sectionName) {
      const match = sections.find(
        (s) =>
          String(s.section_number).trim().toUpperCase() ===
          String(sectionName).trim().toUpperCase()
      );
      if (match) return match.id;
    }
    return sections[0]?.id || 1;
  }, [entry, sectionId, sectionName, sections]);

  // Initialize or reset form state when modal opens or entry changes
  useEffect(() => {
    setError(null);
    if (!open) return;

    if (entry) {
      setSelectedCourseId(entry.course_id ?? "");
      setSelectedFacultyId(entry.faculty_id ?? "");
      setSelectedRoomId(entry.room_id ?? "");
      setSelectedTimeSlotId(entry.time_slot_id ?? timeSlotId ?? "");
      setEntryType(entry.entry_type || "class");
    } else {
      setSelectedCourseId(courses[0]?.id ?? "");
      setSelectedFacultyId(faculty[0]?.id ?? "");
      setSelectedRoomId(rooms[0]?.id ?? "");
      setSelectedTimeSlotId(timeSlotId ?? validTimeSlots[0]?.id ?? "");
      setEntryType("class");
    }
  }, [open, entry, timeSlotId, courses, faculty, rooms, validTimeSlots]);

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
  };

  const handleSave = async () => {
    if (!timetableId) {
      setError("No timetable reference ID available.");
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

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing) {
        await updateTimetableEntry(timetableId, entry.id, {
          course_id: Number(selectedCourseId),
          faculty_id: Number(selectedFacultyId),
          room_id: Number(selectedRoomId),
          time_slot_id: Number(selectedTimeSlotId),
          section_id: targetSectionId,
          entry_type: entryType,
        });
        toast.success("Schedule slot updated successfully!");
      } else {
        await createTimetableEntry(timetableId, {
          course_id: Number(selectedCourseId),
          faculty_id: Number(selectedFacultyId),
          room_id: Number(selectedRoomId),
          time_slot_id: Number(selectedTimeSlotId),
          section_id: targetSectionId,
          entry_type: entryType,
        });
        toast.success("Class assigned successfully to schedule!");
      }

      await qc.invalidateQueries({ queryKey: ["timetable-entries", timetableId] });
      await qc.invalidateQueries({ queryKey: ["timetable", timetableId] });
      await qc.invalidateQueries({ queryKey: ["timetables"] });

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
      title={isEditing ? `Edit Schedule Slot — Section ${sectionName || ""}` : `Assign Class — Section ${sectionName || ""}`}
      size="md"
    >
      <div className="space-y-4">
        {/* Helper subtitle */}
        <p className="text-xs text-ink-500">
          Customize the timing, faculty, subject, or classroom for this slot. All manual changes will immediately update the official schedule.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3.5">
          {/* 1. TIMINGS / TIME SLOT */}
          <div>
            <label className="label flex items-center gap-1.5 text-ink-900 font-bold">
              <Clock className="h-3.5 w-3.5 text-brand-600" />
              1. Timings &amp; Day
            </label>
            <select
              className="select-field text-xs font-semibold"
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
          </div>

          {/* 2. SUBJECT / COURSE */}
          <div>
            <label className="label flex items-center gap-1.5 text-ink-900 font-bold">
              <BookOpen className="h-3.5 w-3.5 text-brand-600" />
              2. Subject / Course
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

          {/* 3. FACULTY */}
          <div>
            <label className="label flex items-center gap-1.5 text-ink-900 font-bold">
              <Users className="h-3.5 w-3.5 text-brand-600" />
              3. Faculty / Instructor
            </label>
            <select
              className="select-field text-xs"
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
          </div>

          {/* 4. CLASSROOM / LAB */}
          <div>
            <label className="label flex items-center gap-1.5 text-ink-900 font-bold">
              <Building2 className="h-3.5 w-3.5 text-brand-600" />
              4. Classroom / Lab Room
            </label>
            <select
              className="select-field text-xs"
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
          </div>

          {/* 5. SESSION TYPE */}
          <div>
            <label className="label text-[11px] text-ink-600 font-medium">
              Session Type
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
              disabled={isSubmitting || isDeleting}
              className="btn-primary text-xs inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700"
            >
              <Save className="h-3.5 w-3.5" />
              {isSubmitting ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
