"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, User } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { Sidebar, MobileNav, MobileDrawer } from "./Sidebar";
import { BrandLogo, BrandLogoIcon } from "./BrandLogo";
import { motion } from "framer-motion";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated()) {
      router.replace("/login");
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted || !isAuthenticated()) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gradient-to-br from-ink-50 via-white to-brand-50/30">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <div className="relative">
            <div className="absolute -inset-2 rounded-2xl bg-brand-500/20 blur-lg animate-pulse" />
            <BrandLogoIcon size="lg" className="relative shadow-lg" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-ink-900 tracking-tight">
              Schedule Designer
            </h2>
            <div className="flex items-center justify-center gap-2 text-xs text-ink-500">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              <span>Loading workspace...</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Desktop & Tablet Sidebar (Collapsible, starts at lg) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile & Tablet Top Bar (Visible on < lg screens) */}
        <header className="lg:hidden flex items-center justify-between px-3.5 sm:px-5 py-2.5 sm:py-3 bg-white/95 backdrop-blur-md border-b border-ink-100 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 sm:p-2 text-ink-600 hover:text-ink-900 hover:bg-ink-100 rounded-xl transition"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <BrandLogo href="/dashboard" size="xs" subtitle={false} />
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full">
              Timetable AI
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-ink-700 bg-ink-50 hover:bg-ink-100 border border-ink-200 px-2 sm:px-2.5 py-1 rounded-full transition"
            >
              <div className="h-5 w-5 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center font-bold">
                {user?.full_name?.[0] || user?.username?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="max-w-[70px] sm:max-w-[100px] truncate hidden xs:inline">
                {user?.full_name?.split(" ")[0] || user?.username}
              </span>
            </button>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 min-w-0 pb-20 md:pb-8">
          <div className="p-3 sm:p-5 md:p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Quick Navigation (Visible on < md) */}
      <MobileNav onOpenMenu={() => setMobileMenuOpen(true)} />

      {/* Mobile/Tablet Slide-Over Navigation Drawer */}
      <MobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </div>
  );
}
