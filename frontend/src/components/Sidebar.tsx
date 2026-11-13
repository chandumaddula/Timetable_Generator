"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Layers,
  DoorOpen,
  Clock,
  Wand2,
  Calendar,
  AlertTriangle,
  LineChart,
  Beaker,
  GraduationCap,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { BrandLogo, BrandLogoIcon } from "@/components/BrandLogo";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: Array<"admin" | "faculty" | "student">;
  category?: "planning" | "academic" | "system";
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["admin"], category: "planning" },
  { label: "Generate", href: "/admin/generate", icon: <Wand2 className="h-5 w-5" />, roles: ["admin"], category: "planning" },
  { label: "Timetables", href: "/admin/timetables", icon: <Calendar className="h-5 w-5" />, roles: ["admin"], category: "planning" },
  { label: "Analytics", href: "/admin/analytics", icon: <LineChart className="h-5 w-5" />, roles: ["admin"], category: "planning" },
  { label: "Conflicts", href: "/admin/conflicts", icon: <AlertTriangle className="h-5 w-5" />, roles: ["admin"], category: "planning" },
  { label: "What-If", href: "/admin/what-if", icon: <Beaker className="h-5 w-5" />, roles: ["admin"], category: "planning" },
  { label: "Courses", href: "/admin/courses", icon: <BookOpen className="h-5 w-5" />, roles: ["admin"], category: "academic" },
  { label: "Faculty", href: "/admin/faculty", icon: <Users className="h-5 w-5" />, roles: ["admin"], category: "academic" },
  { label: "Sections", href: "/admin/sections", icon: <Layers className="h-5 w-5" />, roles: ["admin"], category: "academic" },
  { label: "Rooms", href: "/admin/rooms", icon: <DoorOpen className="h-5 w-5" />, roles: ["admin"], category: "academic" },
  { label: "Time Slots", href: "/admin/time-slots", icon: <Clock className="h-5 w-5" />, roles: ["admin"], category: "academic" },
  { label: "Constraints", href: "/admin/constraints", icon: <Settings className="h-5 w-5" />, roles: ["admin"], category: "system" },
  { label: "My Timetable", href: "/faculty", icon: <Calendar className="h-5 w-5" />, roles: ["faculty"], category: "academic" },
  { label: "My Schedule", href: "/student", icon: <GraduationCap className="h-5 w-5" />, roles: ["student"], category: "academic" },
];

export function Sidebar() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  // Desktop/Tablet collapse state (persists in state)
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const items = NAV_ITEMS.filter((n) => n.roles.includes(role));

  const onLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col bg-white border-r border-ink-100 h-screen sticky top-0 shadow-xs transition-all duration-300 z-20 shrink-0",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className={cn("py-4 border-b border-ink-100 flex items-center justify-between", collapsed ? "px-3 justify-center" : "px-5")}>
        {collapsed ? (
          <BrandLogoIcon size="md" />
        ) : (
          <BrandLogo href="/dashboard" size="sm" subtitle="Timetable AI" animate />
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-brand-50 text-brand-700 font-semibold shadow-xs"
                  : "text-ink-600 hover:text-brand-600 hover:bg-ink-50",
                collapsed && "justify-center px-2"
              )}
            >
              <div className={cn("shrink-0", active ? "text-brand-600" : "text-ink-500")}>
                {item.icon}
              </div>
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && active && (
                <motion.span
                  layoutId="active-pill"
                  className="h-1.5 w-1.5 rounded-full bg-brand-600 shrink-0"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle Button */}
      <div className="px-3 py-2 border-t border-ink-100/60 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100/70 rounded-lg transition text-xs flex items-center gap-1.5"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <span className="text-[11px] font-medium text-ink-500">Collapse</span>
              <ChevronLeft className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* User Card */}
      <div className="border-t border-ink-100 p-3 bg-ink-50/50">
        <div className={cn("flex items-center gap-3 rounded-lg", collapsed ? "justify-center" : "px-2 py-1.5")}>
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            {user?.full_name?.[0] || user?.username?.[0]?.toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900 truncate">
                {user?.full_name || user?.username}
              </p>
              <p className="text-xs text-brand-600 font-medium capitalize">{role}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onLogout}
              title="Sign out"
              className="text-ink-400 hover:text-red-600 transition p-1.5 rounded-lg hover:bg-red-50 shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

/**
 * Mobile and Tablet Slide-Over Drawer Navigation
 */
export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const items = NAV_ITEMS.filter((n) => n.roles.includes(role));

  const onLogout = () => {
    logout();
    router.replace("/login");
  };

  // Close drawer on path change or escape
  useEffect(() => {
    onClose();
  }, [pathname]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs lg:hidden"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-full max-w-xs sm:max-w-sm bg-white shadow-2xl flex flex-col lg:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-ink-100 flex items-center justify-between bg-ink-50/50">
              <BrandLogo href="/dashboard" size="xs" subtitle="Timetable AI" />
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-ink-500 hover:text-ink-800 hover:bg-ink-100 rounded-xl transition"
                title="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400 px-3 mb-2">
                All Navigation
              </div>
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition",
                      active
                        ? "bg-brand-50 text-brand-700 font-semibold shadow-xs"
                        : "text-ink-700 hover:bg-ink-50 hover:text-brand-600"
                    )}
                  >
                    <div className={cn("shrink-0", active ? "text-brand-600" : "text-ink-500")}>
                      {item.icon}
                    </div>
                    <span className="flex-1 truncate">{item.label}</span>
                    {active && (
                      <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* User Footer Profile */}
            <div className="p-4 border-t border-ink-100 bg-ink-50/70 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  {user?.full_name?.[0] || user?.username?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink-900 truncate">
                    {user?.full_name || user?.username}
                  </p>
                  <p className="text-xs text-brand-600 font-semibold capitalize">{role}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="w-full btn-secondary text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 inline-flex items-center justify-center gap-2 py-2"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                Sign Out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Mobile Bottom Quick Bar
 */
export function MobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.role);

  // Pick the 4 most important screens for mobile 1-tap navigation
  const primaryTabs = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Generate", href: "/admin/generate", icon: <Wand2 className="h-5 w-5" /> },
    { label: "Timetables", href: "/admin/timetables", icon: <Calendar className="h-5 w-5" /> },
    { label: "Analytics", href: "/admin/analytics", icon: <LineChart className="h-5 w-5" /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-ink-200 flex items-stretch shadow-lg">
      {primaryTabs.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition",
              active ? "text-brand-600 font-bold" : "text-ink-500 hover:text-brand-600"
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      {/* "More" Trigger for full drawer */}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium text-ink-500 hover:text-brand-600 transition"
      >
        <Menu className="h-5 w-5" />
        <span className="truncate">More</span>
      </button>
    </nav>
  );
}
