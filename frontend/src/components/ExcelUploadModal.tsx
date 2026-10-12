"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  FileUp,
  RefreshCw,
  Sparkles,
  Building2,
  BookOpen,
  Users,
  Layers,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { importExcel, downloadExcelTemplate } from "@/lib/api";

interface ExcelImportCounts {
  departments: number;
  faculty: number;
  courses: number;
  sections: number;
  rooms: number;
  time_slots: number;
  constraints: number;
}

interface ExcelImportResult {
  success: boolean;
  message: string;
  counts: ExcelImportCounts;
  errors?: string[];
  warnings?: string[];
}

interface ExcelUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExcelUploadModal({ open, onClose, onSuccess }: ExcelUploadModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [clearExisting, setClearExisting] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const resetState = () => {
    setFile(null);
    setError(null);
    setImportResult(null);
    setIsUploading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.endsWith(".xlsx") && !selected.name.endsWith(".xls")) {
        setError("Please choose a valid Excel spreadsheet (.xlsx or .xls)");
        return;
      }
      setFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (!selected.name.endsWith(".xlsx") && !selected.name.endsWith(".xls")) {
        setError("Please choose a valid Excel spreadsheet (.xlsx or .xls)");
        return;
      }
      setFile(selected);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      setError(null);
      const res = await downloadExcelTemplate();
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "timetable_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Template download failed", err);
      setError(err?.response?.data?.detail || "Could not download Excel template.");
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select an Excel file to upload.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const response = await importExcel(file, clearExisting);
      const data: ExcelImportResult = response.data;

      // Remember the active uploaded file name for the generator UI badge
      if (typeof window !== "undefined") {
        localStorage.setItem("active_excel_source", file.name);
      }

      setImportResult(data);

      // Invalidate all query caches so Dashboard & Generate pages reflect new data immediately
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["courses"] });
      await queryClient.invalidateQueries({ queryKey: ["faculty"] });
      await queryClient.invalidateQueries({ queryKey: ["sections"] });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      await queryClient.invalidateQueries({ queryKey: ["time-slots"] });
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
      await queryClient.invalidateQueries({ queryKey: ["semesters"] });
      await queryClient.invalidateQueries({ queryKey: ["timetables"] });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Excel upload failed", err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to parse and import Excel file. Please ensure sheet formatting is correct.";
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGoToGenerate = () => {
    handleClose();
    router.push("/admin/generate");
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Upload Institution Excel Data"
      size="lg"
    >
      <div className="space-y-5">
        {/* Intro description */}
        <p className="text-sm text-ink-600">
          Upload curriculum data for your university, college, or school in Excel (<code className="text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded text-xs">.xlsx</code>) format.
          The timetable generator will dynamically load and use your departments, courses, faculty, and sections.
        </p>

        {/* Template download helper card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-brand-50/60 border border-brand-200/60 rounded-xl">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-950">
                Official Multi-Sheet Excel Template
              </p>
              <p className="text-[11px] text-brand-700">
                Supports "BE Subjects" / "Subjects" or multi-sheets (Departments, Faculty, Courses, Rooms).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
            className="btn-secondary text-xs inline-flex items-center gap-1.5 self-start sm:self-center shrink-0 border-brand-300 hover:bg-brand-100/50"
          >
            <Download className={`h-3.5 w-3.5 ${isDownloadingTemplate ? "animate-bounce" : ""}`} />
            {isDownloadingTemplate ? "Downloading..." : "Download Template"}
          </button>
        </div>

        {/* Success View */}
        {importResult ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-5 py-2"
          >
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">
                  Excel Data Successfully Imported!
                </p>
                <p className="text-xs text-emerald-800">
                  {importResult.message || `Loaded institution data from ${file?.name || "your file"}.`}
                </p>
              </div>
            </div>

            {/* Imported Counts Grid */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2.5">
                Imported System Records
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-ink-50 rounded-xl border border-ink-100 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-ink-900 block leading-tight">
                      {importResult.counts?.departments ?? 0}
                    </span>
                    <span className="text-[11px] text-ink-500 font-medium">Departments</span>
                  </div>
                </div>

                <div className="p-3 bg-ink-50 rounded-xl border border-ink-100 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-ink-900 block leading-tight">
                      {importResult.counts?.courses ?? 0}
                    </span>
                    <span className="text-[11px] text-ink-500 font-medium">Courses</span>
                  </div>
                </div>

                <div className="p-3 bg-ink-50 rounded-xl border border-ink-100 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-ink-900 block leading-tight">
                      {importResult.counts?.faculty ?? 0}
                    </span>
                    <span className="text-[11px] text-ink-500 font-medium">Faculty</span>
                  </div>
                </div>

                <div className="p-3 bg-ink-50 rounded-xl border border-ink-100 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-ink-900 block leading-tight">
                      {importResult.counts?.sections ?? 0}
                    </span>
                    <span className="text-[11px] text-ink-500 font-medium">Sections</span>
                  </div>
                </div>

                <div className="p-3 bg-ink-50 rounded-xl border border-ink-100 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-ink-900 block leading-tight">
                      {importResult.counts?.rooms ?? 0}
                    </span>
                    <span className="text-[11px] text-ink-500 font-medium">Rooms</span>
                  </div>
                </div>

                <div className="p-3 bg-ink-50 rounded-xl border border-ink-100 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-100 text-cyan-700">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-ink-900 block leading-tight">
                      {importResult.counts?.time_slots ?? 0}
                    </span>
                    <span className="text-[11px] text-ink-500 font-medium">Time Slots</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Warnings if any */}
            {importResult.warnings && importResult.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  Notice: {importResult.warnings.length} row(s) had notes:
                </p>
                <div className="max-h-24 overflow-y-auto space-y-0.5 text-[11px] text-amber-800">
                  {importResult.warnings.slice(0, 5).map((w, idx) => (
                    <div key={idx}>• {w}</div>
                  ))}
                  {importResult.warnings.length > 5 && (
                    <div>...and {importResult.warnings.length - 5} more.</div>
                  )}
                </div>
              </div>
            )}

            {/* Next Step Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-ink-100">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary text-sm"
              >
                Close & View Dashboard
              </button>
              <button
                type="button"
                onClick={handleGoToGenerate}
                className="btn-primary text-sm inline-flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate Timetable Now
              </button>
            </div>
          </motion.div>
        ) : (
          /* Upload Form */
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-brand-500 bg-brand-50/70 scale-[0.99]"
                  : file
                  ? "border-emerald-400 bg-emerald-50/30"
                  : "border-ink-200 hover:border-brand-400 hover:bg-brand-50/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink-900 text-sm">{file.name}</p>
                    <p className="text-xs text-ink-500">
                      {(file.size / 1024).toFixed(1)} KB — Ready to import
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="mt-1 text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1 font-medium"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove and choose another
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2.5">
                  <div className="h-12 w-12 rounded-xl bg-ink-100 text-ink-600 flex items-center justify-center">
                    <FileUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink-900 text-sm">
                      Click to choose or drag & drop Excel workbook
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      Accepts standard <code className="font-mono text-ink-700">.xlsx</code> or <code className="font-mono text-ink-700">.xls</code> files
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Clear existing toggle */}
            <div className="p-3.5 bg-ink-50 rounded-xl border border-ink-200/80">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-ink-900 block">
                    Replace existing data with this institution's data (Recommended)
                  </span>
                  <span className="text-[11px] text-ink-600 block">
                    Clears previous sample or old university records so schedules are generated exclusively with your new curriculum.
                  </span>
                </div>
              </label>
            </div>

            {/* Error display */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-100">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary text-sm"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="btn-primary text-sm inline-flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Processing & Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload & Process Data
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
