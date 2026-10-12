"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTimetable,
  getTimetableEntries,
  getTimeSlots,
  getCourses,
  getFaculty,
  getRooms,
  getSections,
  getAnalytics,
  validateTimetable,
  finalizeTimetable,
} from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { LoadingState, ErrorState } from "@/components/States";
import { Badge, StatusBadge } from "@/components/Badge";
import { useToast } from "@/components/Toast";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  ArrowLeft,
  ListChecks,
  BarChart3,
  Layers,
  Users,
  BookOpen,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { dayShort, dayName, formatTime, scoreColor } from "@/lib/utils";
import { Course, Faculty, Room, Section, TimeSlot, TimetableEntry } from "@/lib/types";
import { InstitutionalTimetableSheet } from "@/components/InstitutionalTimetableSheet";
import { FileText } from "lucide-react";

type ViewMode = "master" | "faculty" | "section" | "room";
type Tab = "institutional" | "grid" | "list" | "analytics" | "conflicts";

export default function TimetableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const id = Number(params.id);
  const [view, setView] = useState<ViewMode>("master");
  const [tab, setTab] = useState<Tab>("institutional");

  const { data: timetable, isLoading: loadingTT, error: errorTT, refetch: refetchTT } = useQuery({
    queryKey: ["timetable", id],
    queryFn: () => getTimetable(id).then((r) => r.data),
  });

  const { data: entries, isLoading: loadingE } = useQuery<TimetableEntry[]>({
    queryKey: ["timetable-entries", id],
    queryFn: () => getTimetableEntries(id).then((r) => r.data),
  });

  const { data: timeSlots } = useQuery<TimeSlot[]>({
    queryKey: ["time-slots"],
    queryFn: () => getTimeSlots({ limit: 300 }).then((r) => r.data),
  });

  const { data: courses } = useQuery<Course[]>({ queryKey: ["courses"], queryFn: () => getCourses({ limit: 200 }).then((r) => r.data) });
  const { data: faculty } = useQuery<Faculty[]>({ queryKey: ["faculty"], queryFn: () => getFaculty({ limit: 200 }).then((r) => r.data) });
  const { data: rooms } = useQuery<Room[]>({ queryKey: ["rooms"], queryFn: () => getRooms({ limit: 200 }).then((r) => r.data) });
  const { data: sections } = useQuery<Section[]>({ queryKey: ["sections"], queryFn: () => getSections({ limit: 200 }).then((r) => r.data) });

  const { data: analytics } = useQuery({
    queryKey: ["analytics", id],
    queryFn: () => getAnalytics(id).then((r) => r.data),
  });

  const validate = useMutation({
    mutationFn: () => validateTimetable(id),
    onSuccess: (res) => {
      const v = res.data;
      toast[v.valid ? "success" : "warning"](
        v.valid ? "No violations found" : `Found ${v.hard_violations} hard and ${v.soft_violations} soft violations`
      );
      qc.invalidateQueries({ queryKey: ["analytics", id] });
    },
    onError: () => toast.error("Validation failed"),
  });

  const finalize = useMutation({
    mutationFn: () => finalizeTimetable(id),
    onSuccess: () => {
      toast.success("Timetable finalized");
      qc.invalidateQueries({ queryKey: ["timetable", id] });
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error("Failed to finalize", e.response?.data?.detail),
  });

  // Build lookup maps
  const slotMap = useMemo(() => new Map((timeSlots ?? []).map((s) => [s.id, s])), [timeSlots]);
  const courseMap = useMemo(() => new Map((courses ?? []).map((c) => [c.id, c])), [courses]);
  const facultyMap = useMemo(() => new Map((faculty ?? []).map((f) => [f.id, f])), [faculty]);
  const roomMap = useMemo(() => new Map((rooms ?? []).map((r) => [r.id, r])), [rooms]);
  const sectionMap = useMemo(() => new Map((sections ?? []).map((s) => [s.id, s])), [sections]);

  // Compute unique days/periods
  const days = useMemo(() => Array.from(new Set((timeSlots ?? []).map((s) => s.day_of_week))).sort(), [timeSlots]);
  const sortedSlots = useMemo(() => {
    return [...(timeSlots ?? [])].sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      return String(a.start_time).localeCompare(String(b.start_time));
    });
  }, [timeSlots]);

  // Extract distinct sections present in entries
  const distinctSections = useMemo(() => {
    const set = new Set<string>();
    (entries ?? []).forEach((e: any) => {
      const secNum =
        typeof e.section === "string"
          ? e.section
          : e.section?.section_number || e.section_name || sectionMap.get(e.section_id)?.section_number;
      if (secNum) set.add(String(secNum).trim().toUpperCase());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [entries, sectionMap]);

  // Clean authoritative display title
  const displayTitle = useMemo(() => {
    if (!timetable) return "Timetable";
    let baseName = timetable.name || "";
    baseName = baseName.replace(/Semester\s+Semester/gi, "Semester");
    if (distinctSections.length > 1) {
      const secPattern = /\(Section\s+[A-Za-z0-9]+\)/i;
      if (secPattern.test(baseName)) {
        baseName = baseName.replace(secPattern, `(Sections ${distinctSections.join(", ")})`);
      } else if (!baseName.includes("Section")) {
        baseName += ` (Sections ${distinctSections.join(", ")})`;
      }
    }
    return baseName;
  }, [timetable, distinctSections]);

  if (loadingTT) {
    return (
      <AppShell>
        <LoadingState message="Loading timetable..." fullPage />
      </AppShell>
    );
  }
  if (errorTT || !timetable) {
    return (
      <AppShell>
        <PageHeader title="Timetable Not Found" icon={<Calendar className="h-5 w-5" />} />
        <ErrorState message="The timetable you're looking for doesn't exist." onRetry={refetchTT} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={displayTitle}
        description={`Version ${timetable.version} • ${timetable.is_finalized ? "Finalized" : "Draft"}${distinctSections.length > 1 ? ` • ${distinctSections.length} Sections Generated` : ""}`}
        icon={<Calendar className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/admin/timetables")}
              className="btn-secondary"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => validate.mutate()}
              disabled={validate.isPending}
              className="btn-secondary"
            >
              <Sparkles className="h-4 w-4" /> Validate
            </button>
            {!timetable.is_finalized && (
              <button onClick={() => finalize.mutate()} className="btn-primary">
                <CheckCircle2 className="h-4 w-4" /> Finalize
              </button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard
          label="Total Assignments"
          value={entries?.length ?? 0}
          icon={<ListChecks className="h-4 w-4" />}
        />
        <StatCard
          label="Sections"
          value={distinctSections.length || 1}
          icon={<Layers className="h-4 w-4" />}
          variant="info"
        />
        <StatCard
          label="Courses"
          value={new Set((entries ?? []).map((e) => e.course_id)).size}
          icon={<BookOpen className="h-4 w-4" />}
        />
        <StatCard
          label="Faculty"
          value={new Set((entries ?? []).map((e) => e.faculty_id)).size}
          icon={<Users className="h-4 w-4" />}
          variant="success"
        />
        <StatCard
          label="Rooms"
          value={new Set((entries ?? []).map((e) => e.room_id)).size}
          icon={<Building2 className="h-4 w-4" />}
          variant="warning"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-ink-100 mb-5 flex items-center gap-1 overflow-x-auto">
        {([
          ["institutional", "Institutional Sheet", <FileText className="h-4 w-4" />],
          ["grid", "Interactive Grid", <Layers className="h-4 w-4" />],
          ["list", "List View", <ListChecks className="h-4 w-4" />],
          ["analytics", "Analytics", <BarChart3 className="h-4 w-4" />],
          ["conflicts", "Validation", <AlertTriangle className="h-4 w-4" />],
        ] as Array<[Tab, string, React.ReactNode]>).map(([t, label, icon]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
              tab === t
                ? "border-brand-600 text-brand-700 font-semibold"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Institutional Sheet tab */}
      {tab === "institutional" && (
        <InstitutionalTimetableSheet
          entries={entries ?? []}
          timeSlots={sortedSlots}
          courses={courses ?? []}
          faculty={faculty ?? []}
          rooms={rooms ?? []}
          sections={sections ?? []}
          title={displayTitle}
          subtitle={`Version ${timetable.version} • Official Department Schedule`}
          showExportButtons={true}
          showSectionTabs={true}
          timetableId={id}
          editable={true}
          onEntrySaved={() => {
            qc.invalidateQueries({ queryKey: ["timetable-entries", id] });
            qc.invalidateQueries({ queryKey: ["timetable", id] });
            qc.invalidateQueries({ queryKey: ["analytics", id] });
          }}
        />
      )}

      {/* Grid tab */}
      {tab === "grid" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-ink-500">View by:</span>
            {(["master", "faculty", "section", "room"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                  view === v
                    ? "bg-brand-600 text-white"
                    : "bg-white border border-ink-200 text-ink-700 hover:border-brand-300"
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {loadingE ? (
            <LoadingState message="Loading schedule..." />
          ) : (
            <TimetableGrid
              entries={entries ?? []}
              timeSlots={sortedSlots}
              view={view}
              courseMap={courseMap}
              facultyMap={facultyMap}
              roomMap={roomMap}
              sectionMap={sectionMap}
              days={days}
            />
          )}
        </div>
      )}

      {/* List tab */}
      {tab === "list" && (
        <div className="card">
          <h3 className="font-semibold text-ink-900 mb-3">All Assignments</h3>
          {loadingE ? (
            <LoadingState message="Loading entries..." />
          ) : (entries ?? []).length === 0 ? (
            <p className="text-ink-500 text-sm py-4">No entries in this timetable.</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {(entries ?? []).map((e) => {
                const c = courseMap.get(e.course_id);
                const f = facultyMap.get(e.faculty_id);
                const r = roomMap.get(e.room_id);
                const s = sectionMap.get(e.section_id);
                const ts = slotMap.get(e.time_slot_id);
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-ink-100 hover:bg-ink-50 transition"
                  >
                    <div className="text-xs text-ink-500 font-mono w-32 shrink-0">
                      {ts ? `${dayShort(ts.day_of_week)} ${formatTime(String(ts.start_time))}` : "—"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-900 text-sm">{c?.code} — {c?.name}</p>
                      <p className="text-xs text-ink-500">
                        {f?.name} • {r?.room_number} • {r?.building || "—"} • Sec {s?.section_number}
                      </p>
                    </div>
                    <Badge variant={e.entry_type === "lab" ? "info" : "neutral"}>
                      {e.entry_type}
                    </Badge>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Analytics tab */}
      {tab === "analytics" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold text-ink-900 mb-3">Faculty Workload</h3>
            {analytics && Object.keys(analytics.faculty_utilization || {}).length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {Object.entries(analytics.faculty_utilization)
                  .sort(([, a], [, b]) => Number(b) - Number(a))
                  .map(([fid, hours]) => {
                    const f = facultyMap.get(Number(fid));
                    const max = Math.max(...Object.values(analytics.faculty_utilization).map(Number));
                    const pct = max ? (Number(hours) / max) * 100 : 0;
                    return (
                      <div key={fid}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-ink-700">{f?.name || `Faculty #${fid}`}</span>
                          <span className="font-semibold text-ink-900">{Number(hours)}h</span>
                        </div>
                        <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-ink-500">No data</p>
            )}
          </div>
          <div className="card">
            <h3 className="font-semibold text-ink-900 mb-3">Room Usage</h3>
            {analytics && Object.keys(analytics.room_utilization || {}).length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {Object.entries(analytics.room_utilization)
                  .sort(([, a], [, b]) => Number(b) - Number(a))
                  .map(([rid, count]) => {
                    const r = roomMap.get(Number(rid));
                    const max = Math.max(...Object.values(analytics.room_utilization).map(Number));
                    const pct = max ? (Number(count) / max) * 100 : 0;
                    return (
                      <div key={rid}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-ink-700">{r?.room_number || `Room #${rid}`}</span>
                          <span className="font-semibold text-ink-900">{Number(count)} classes</span>
                        </div>
                        <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-ink-500">No data</p>
            )}
          </div>
        </div>
      )}

      {/* Validation tab */}
      {tab === "conflicts" && (
        <ValidationView timetableId={id} />
      )}
    </AppShell>
  );
}

interface GridProps {
  entries: TimetableEntry[];
  timeSlots: TimeSlot[];
  view: ViewMode;
  courseMap: Map<number, Course>;
  facultyMap: Map<number, Faculty>;
  roomMap: Map<number, Room>;
  sectionMap: Map<number, Section>;
  days: number[];
}

function TimetableGrid({ entries, timeSlots, view, courseMap, facultyMap, roomMap, sectionMap, days }: GridProps) {
  if (!days.length || !timeSlots.length) {
    return (
      <div className="card text-center text-ink-500 py-8">No time slots configured.</div>
    );
  }

  // Determine which entities to show on the left
  const groupedByEntity = new Map<string, typeof entries>();
  if (view === "master") {
    groupedByEntity.set("All", entries);
  } else if (view === "faculty") {
    entries.forEach((e) => {
      const key = facultyMap.get(e.faculty_id)?.name || `Faculty #${e.faculty_id}`;
      if (!groupedByEntity.has(key)) groupedByEntity.set(key, []);
      groupedByEntity.get(key)!.push(e);
    });
  } else if (view === "section") {
    entries.forEach((e: any) => {
      const secNum = sectionMap.get(e.section_id)?.section_number || e.section?.section_number || e.section_name || `#${e.section_id}`;
      const key = `Section ${secNum}`;
      if (!groupedByEntity.has(key)) groupedByEntity.set(key, []);
      groupedByEntity.get(key)!.push(e);
    });
  } else {
    entries.forEach((e) => {
      const key = roomMap.get(e.room_id)?.room_number || `Room #${e.room_id}`;
      if (!groupedByEntity.has(key)) groupedByEntity.set(key, []);
      groupedByEntity.get(key)!.push(e);
    });
  }

  return (
    <div className="space-y-6">
      {Array.from(groupedByEntity.entries()).map(([entity, ents]) => (
        <div key={entity} className="card overflow-hidden">
          <h3 className="font-semibold text-ink-900 mb-3 text-sm">{entity}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-ink-500 font-medium border-b border-ink-100 sticky left-0 bg-white">Time</th>
                  {days.map((d) => (
                    <th key={d} className="p-2 text-ink-700 font-semibold border-b border-ink-100 min-w-[110px]">
                      {dayShort(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots
                  .filter((s) => days.includes(s.day_of_week))
                  .filter((s, i, arr) => arr.findIndex((x) => x.start_time === s.start_time) === i)
                  .map((slot) => {
                    const startTime = String(slot.start_time).slice(0, 5);
                    return (
                      <tr key={startTime} className="border-b border-ink-50">
                        <td className="p-2 font-mono text-ink-500 sticky left-0 bg-white border-r border-ink-100">
                          {startTime}
                        </td>
                        {days.map((d) => {
                          const slotMatch = timeSlots.find((s) => s.day_of_week === d && String(s.start_time).slice(0, 5) === startTime);
                          if (slotMatch?.is_break) {
                            return (
                              <td key={d} className="p-1.5">
                                <div className="rounded-md p-2 text-center text-amber-700 bg-amber-50 border border-amber-100 text-xs">
                                  Break
                                </div>
                              </td>
                            );
                          }
                          const cellEntries = ents.filter((e) => e.time_slot_id === slotMatch?.id);
                          return (
                            <td key={d} className="p-1.5">
                              {cellEntries.length === 0 ? (
                                <div className="h-12 rounded-md border border-dashed border-ink-100" />
                              ) : (
                                <div className="space-y-1">
                                  {cellEntries.map((e) => {
                                    const c = courseMap.get(e.course_id);
                                    const r = roomMap.get(e.room_id);
                                    const f = facultyMap.get(e.faculty_id);
                                    return (
                                      <div
                                        key={e.id}
                                        className={`p-1.5 rounded-md text-xs ${
                                          e.entry_type === "lab"
                                            ? "bg-purple-50 border border-purple-200 text-purple-800"
                                            : "bg-brand-50 border border-brand-200 text-brand-800"
                                        }`}
                                        title={`${c?.code} • ${f?.name} • ${r?.room_number}`}
                                      >
                                        <p className="font-semibold truncate">{c?.code}</p>
                                        <p className="truncate opacity-75">{r?.room_number}</p>
                                        <p className="truncate opacity-75 text-[10px]">{f?.name?.split(" ")[0]}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ValidationView({ timetableId }: { timetableId: number }) {
  const { data: result, isLoading, refetch } = useQuery({
    queryKey: ["validation", timetableId],
    queryFn: () => validateTimetable(timetableId).then((r) => r.data),
  });

  if (isLoading) return <LoadingState message="Validating timetable..." />;
  if (!result) return <ErrorState message="Could not load validation" onRetry={refetch} />;

  const issues = (result.issues || []) as Array<{ severity: string; message: string; suggestion?: string; code?: string }>;
  const hardIssues = issues.filter((i) => i.severity === "hard" || i.severity === "error");
  const softIssues = issues.filter((i) => i.severity === "soft" || i.severity === "warning");

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-ink-900">Validation Result</h3>
          <p className="text-sm text-ink-500">
            {result.valid ? "No hard violations found" : `${hardIssues.length} hard violation(s) need to be addressed`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-xs text-ink-500">Score</p>
            <p className={`text-2xl font-bold ${scoreColor(Number(result.score))}`}>
              {Number(result.score).toFixed(1)}%
            </p>
          </div>
          <div className="h-10 border-l border-ink-200" />
          <div className="text-center">
            <p className="text-xs text-ink-500">Hard</p>
            <p className="text-2xl font-bold text-red-600">{hardIssues.length}</p>
          </div>
          <div className="h-10 border-l border-ink-200" />
          <div className="text-center">
            <p className="text-xs text-ink-500">Soft</p>
            <p className="text-2xl font-bold text-amber-600">{softIssues.length}</p>
          </div>
        </div>
      </div>

      {hardIssues.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h4 className="font-semibold text-ink-900">Hard Violations ({hardIssues.length})</h4>
          </div>
          <div className="space-y-2">
            {hardIssues.map((iss, i) => (
              <div key={i} className="p-3 rounded-lg border border-red-100 bg-red-50">
                <p className="text-sm text-red-800 font-medium">{iss.message}</p>
                {iss.suggestion && <p className="text-xs text-red-600 mt-1">💡 {iss.suggestion}</p>}
                {iss.code && <Badge variant="danger" className="mt-1">{iss.code}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {softIssues.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h4 className="font-semibold text-ink-900">Soft Violations ({softIssues.length})</h4>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {softIssues.map((iss, i) => (
              <div key={i} className="p-3 rounded-lg border border-amber-100 bg-amber-50">
                <p className="text-sm text-amber-800 font-medium">{iss.message}</p>
                {iss.suggestion && <p className="text-xs text-amber-600 mt-1">💡 {iss.suggestion}</p>}
                {iss.code && <Badge variant="warning" className="mt-1">{iss.code}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {issues.length === 0 && (
        <div className="card text-center py-12">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-ink-900">All Constraints Satisfied</h3>
          <p className="text-sm text-ink-500">This timetable has no violations.</p>
        </div>
      )}
    </div>
  );
}
