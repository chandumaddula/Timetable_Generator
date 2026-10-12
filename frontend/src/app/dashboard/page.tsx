"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BookOpen,
  Users,
  Layers,
  Building2,
  Clock,
  CalendarRange,
  Sparkles,
  Plus,
  ArrowRight,
  GraduationCap,
  BarChart3,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Upload,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { DataTable } from "@/components/DataTable";
import { ExcelUploadModal } from "@/components/ExcelUploadModal";
import { useAuthStore } from "@/lib/auth";
import {
  getCourses,
  getFaculty,
  getSections,
  getRooms,
  getTimeSlots,
  getTimetables,
  getAnalytics,
  generateTimetable,
} from "@/lib/api";
import type {
  Course,
  Faculty,
  Section,
  Room,
  TimeSlot,
  Timetable,
  Analytics,
} from "@/lib/types";

// --- Helpers -------------------------------------------------------------

const unwrap = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.results)) return obj.results as T[];
  }
  return [];
};

const countFrom = (payload: unknown): number => {
  const arr = unwrap<unknown>(payload);
  if (arr.length > 0) return arr.length;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.total === "number") return obj.total;
    if (typeof obj.count === "number") return obj.count;
  }
  return 0;
};

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

// --- Page ----------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Fetch all entity counts in parallel
  const coursesQ = useQuery({
    queryKey: ["dashboard", "courses"],
    queryFn: async () => (await getCourses({ skip: 0, limit: 1 })).data,
  });
  const facultyQ = useQuery({
    queryKey: ["dashboard", "faculty"],
    queryFn: async () => (await getFaculty({ skip: 0, limit: 1 })).data,
  });
  const sectionsQ = useQuery({
    queryKey: ["dashboard", "sections"],
    queryFn: async () => (await getSections({ skip: 0, limit: 1 })).data,
  });
  const roomsQ = useQuery({
    queryKey: ["dashboard", "rooms"],
    queryFn: async () => (await getRooms({ skip: 0, limit: 1 })).data,
  });
  const timeSlotsQ = useQuery({
    queryKey: ["dashboard", "timeslots"],
    queryFn: async () => (await getTimeSlots({ skip: 0, limit: 1 })).data,
  });
  const timetablesQ = useQuery({
    queryKey: ["dashboard", "timetables", "list"],
    queryFn: async () => (await getTimetables({ skip: 0, limit: 50 })).data,
  });
  const analyticsQ = useQuery({
    queryKey: ["dashboard", "analytics"],
    queryFn: async () => (await getAnalytics()).data as Analytics | undefined,
  });

  const queries = [coursesQ, facultyQ, sectionsQ, roomsQ, timeSlotsQ, timetablesQ];

  const isInitialLoading = queries.some((q) => q.isLoading && q.isFetching);
  const hasError = queries.some((q) => q.isError);
  const firstError = queries.find((q) => q.isError);

  // Counts
  const counts = useMemo(
    () => ({
      courses: countFrom(coursesQ.data),
      faculty: countFrom(facultyQ.data),
      sections: countFrom(sectionsQ.data),
      rooms: countFrom(roomsQ.data),
      timeSlots: countFrom(timeSlotsQ.data),
      timetables: countFrom(timetablesQ.data),
    }),
    [
      coursesQ.data,
      facultyQ.data,
      sectionsQ.data,
      roomsQ.data,
      timeSlotsQ.data,
      timetablesQ.data,
    ]
  );

  // Recent timetables (last 5)
  const recentTimetables = useMemo<Timetable[]>(() => {
    const list = unwrap<Timetable>(timetablesQ.data);
    return [...list]
      .sort((a, b) => {
        const ad = new Date(a.generated_at || a.created_at || 0).getTime();
        const bd = new Date(b.generated_at || b.created_at || 0).getTime();
        return bd - ad;
      })
      .slice(0, 5);
  }, [timetablesQ.data]);

  // Derived analytics
  const analytics = analyticsQ.data;
  const facultyUtilizationAvg = useMemo(() => {
    if (!analytics?.faculty_utilization) return 0;
    const vals = Object.values(analytics.faculty_utilization);
    if (vals.length === 0) return 0;
    const sum = vals.reduce((acc, v) => acc + (Number(v) || 0), 0);
    return Math.round(sum / vals.length);
  }, [analytics]);

  // Handlers
  const refreshAll = () => {
    queries.forEach((q) => q.refetch());
    analyticsQ.refetch();
  };

  const handleQuickGenerate = async () => {
    try {
      const res = await generateTimetable({ name: "Auto-generated" });
      const id = (res.data as { timetable_id?: number })?.timetable_id;
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (id) {
        router.push(`/admin/timetables/${id}`);
      } else {
        router.push("/admin/timetables");
      }
    } catch (e) {
      // Surface error inline; user can navigate manually
      console.error("Quick generate failed", e);
      refreshAll();
    }
  };

  // --- Render -----------------------------------------------------------

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description={
          user?.full_name
            ? `Welcome back, ${user.full_name}. Here's an overview of your timetable system.`
            : "Welcome back. Here's an overview of your timetable system."
        }
        icon={<GraduationCap className="h-5 w-5" />}
        actions={
          <>
            <button
              onClick={refreshAll}
              className="btn-secondary inline-flex items-center gap-2"
              disabled={isInitialLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${isInitialLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="btn-secondary inline-flex items-center gap-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Upload Excel Data
            </button>
            <Link href="/admin/generate" className="btn-primary inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Timetable
            </Link>
          </>
        }
      />

      {hasError ? (
        <ErrorState
          title="Failed to load dashboard"
          message={
            (firstError?.error as Error | undefined)?.message ||
            "We couldn't fetch some of your dashboard data. Please try again."
          }
          onRetry={refreshAll}
        />
      ) : isInitialLoading ? (
        <DashboardSkeleton />
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Custom Institution Excel Banner */}
          <motion.section variants={fadeUp}>
            <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-brand-50/60 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-900">
                    Custom Institution Data (.xlsx)
                  </h3>
                  <p className="text-xs text-ink-600 mt-0.5">
                    Using your own university, college, or school curriculum? Upload an Excel sheet to dynamically load departments, subjects, faculty, and generate clash-free timetables.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="btn-primary text-xs shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Excel Sheet
              </button>
            </div>
          </motion.section>

          {/* Stats grid */}
          <motion.section variants={fadeUp}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard
                label="Total Courses"
                value={counts.courses}
                hint="Active curriculum"
                icon={<BookOpen className="h-5 w-5" />}
                variant="info"
              />
              <StatCard
                label="Faculty"
                value={counts.faculty}
                hint="Teaching staff"
                icon={<Users className="h-5 w-5" />}
                variant="success"
              />
              <StatCard
                label="Sections"
                value={counts.sections}
                hint="Class groups"
                icon={<Layers className="h-5 w-5" />}
                variant="default"
              />
              <StatCard
                label="Rooms"
                value={counts.rooms}
                hint="Available spaces"
                icon={<Building2 className="h-5 w-5" />}
                variant="warning"
              />
              <StatCard
                label="Time Slots"
                value={counts.timeSlots}
                hint="Configured periods"
                icon={<Clock className="h-5 w-5" />}
                variant="info"
              />
              <StatCard
                label="Timetables"
                value={counts.timetables}
                hint="Generated schedules"
                icon={<CalendarRange className="h-5 w-5" />}
                variant="default"
              />
            </div>
          </motion.section>

          {/* Content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent timetables */}
            <motion.section
              variants={fadeUp}
              className="lg:col-span-2 bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                    <CalendarRange className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-ink-900">
                      Recent Timetables
                    </h2>
                    <p className="text-xs text-ink-500">
                      Last 5 generated schedules
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/timetables"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="p-2 sm:p-3">
                {timetablesQ.isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-brand-200 border-t-brand-600" />
                  </div>
                ) : recentTimetables.length === 0 ? (
                  <EmptyState
                    icon={<CalendarRange className="h-6 w-6" />}
                    title="No timetables yet"
                    description="Get started by generating your first timetable from the available courses, faculty, and rooms."
                    action={
                      <Link
                        href="/admin/generate"
                        className="btn-primary inline-flex items-center gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        Generate Timetable
                      </Link>
                    }
                  />
                ) : (
                  <DataTable<Timetable>
                    columns={[
                      {
                        key: "name",
                        header: "Name",
                        render: (row) => (
                          <div className="min-w-0">
                            <p className="font-medium text-ink-900 truncate">
                              {row.name}
                            </p>
                            <p className="text-xs text-ink-500">
                              v{row.version ?? 1}
                            </p>
                          </div>
                        ),
                      },
                      {
                        key: "generated_at",
                        header: "Generated",
                        render: (row) => (
                          <span className="text-sm text-ink-600">
                            {row.generated_at
                              ? new Date(row.generated_at).toLocaleString()
                              : "—"}
                          </span>
                        ),
                      },
                      {
                        key: "is_finalized",
                        header: "Status",
                        render: (row) =>
                          row.is_finalized ? (
                            <Badge variant="success" dot>
                              Finalized
                            </Badge>
                          ) : (
                            <Badge variant="warning" dot>
                              Draft
                            </Badge>
                          ),
                      },
                      {
                        key: "actions",
                        header: "",
                        className: "text-right",
                        render: (row) => (
                          <Link
                            href={`/admin/timetables/${row.id}`}
                            className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 text-sm font-medium"
                          >
                            Open
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ),
                      },
                    ]}
                    data={recentTimetables}
                    onRowClick={(row) => router.push(`/admin/timetables/${row.id}`)}
                  />
                )}
              </div>
            </motion.section>

            {/* Right column: quick actions + analytics */}
            <motion.section variants={fadeUp} className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-100">
                  <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-ink-900">
                      Quick Actions
                    </h2>
                    <p className="text-xs text-ink-500">Common tasks</p>
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  <QuickActionButton
                    icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
                    title="Upload Excel Sheet"
                    description="Import institution data (.xlsx)"
                    onClick={() => setIsUploadModalOpen(true)}
                  />
                  <QuickAction
                    href="/admin/generate"
                    icon={<Sparkles className="h-4 w-4" />}
                    title="Generate Timetable"
                    description="Create a new schedule"
                    onClick={handleQuickGenerate}
                  />
                  <QuickAction
                    href="/admin/courses"
                    icon={<Plus className="h-4 w-4" />}
                    title="Manage Courses"
                    description="Add or edit courses"
                  />
                  <QuickAction
                    href="/admin/faculty"
                    icon={<Users className="h-4 w-4" />}
                    title="Manage Faculty"
                    description="Update teaching staff"
                  />
                  <QuickAction
                    href="/admin/rooms"
                    icon={<Building2 className="h-4 w-4" />}
                    title="Manage Rooms"
                    description="Configure rooms & labs"
                  />
                  <QuickAction
                    href="/admin/time-slots"
                    icon={<Clock className="h-4 w-4" />}
                    title="Configure Time Slots"
                    description="Set periods and breaks"
                  />
                  <QuickAction
                    href="/admin/sections"
                    icon={<Layers className="h-4 w-4" />}
                    title="Manage Sections"
                    description="Organize class groups"
                  />
                </div>
              </div>

              {/* Analytics snapshot */}
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-ink-900">
                        Utilization
                      </h2>
                      <p className="text-xs text-ink-500">Latest analytics</p>
                    </div>
                  </div>
                  <Link
                    href="/admin/analytics"
                    className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
                  >
                    Details
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="p-5 space-y-4">
                  <UtilizationBar
                    label="Faculty"
                    percent={facultyUtilizationAvg}
                  />
                  <UtilizationBar
                    label="Rooms"
                    percent={avgPercent(analytics?.room_utilization)}
                  />
                  <UtilizationBar
                    label="Time Slots"
                    percent={avgPercent(analytics?.time_slot_utilization)}
                  />
                  <div className="pt-3 border-t border-ink-100 flex items-center justify-between text-sm">
                    <span className="text-ink-500">Total assignments</span>
                    <span className="font-semibold text-ink-900">
                      {analytics?.total_entries ?? "—"}
                    </span>
                  </div>
                  {analyticsQ.isError && (
                    <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>Analytics unavailable right now.</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          </div>
        </motion.div>
      )}

      <ExcelUploadModal
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={refreshAll}
      />
    </AppShell>
  );
}

// --- Sub-components ------------------------------------------------------

function QuickActionButton({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left group flex items-center gap-3 p-2.5 rounded-lg hover:bg-ink-50 transition-colors"
    >
      <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900 truncate">{title}</p>
        <p className="text-xs text-ink-500 truncate">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-ink-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-ink-50 transition-colors"
    >
      <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100 flex items-center justify-center shrink-0 transition-colors">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900 truncate">{title}</p>
        <p className="text-xs text-ink-500 truncate">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

function UtilizationBar({
  label,
  percent,
}: {
  label: string;
  percent: number;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const color =
    safe >= 75
      ? "bg-emerald-500"
      : safe >= 40
      ? "bg-brand-500"
      : "bg-amber-500";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-ink-700">{label}</span>
        <span className="text-ink-500">{safe}%</span>
      </div>
      <div className="h-2 w-full bg-ink-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safe}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
    </div>
  );
}

function avgPercent(record: Record<string, number> | undefined): number {
  if (!record) return 0;
  const vals = Object.values(record);
  if (vals.length === 0) return 0;
  const sum = vals.reduce((acc, v) => acc + (Number(v) || 0), 0);
  return Math.round(sum / vals.length);
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-ink-100 p-4 h-24 animate-pulse"
          >
            <div className="h-3 w-20 bg-ink-100 rounded mb-3" />
            <div className="h-6 w-12 bg-ink-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-ink-100 p-6 h-80 animate-pulse" />
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-ink-100 p-6 h-72 animate-pulse" />
          <div className="bg-white rounded-2xl border border-ink-100 p-6 h-48 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
