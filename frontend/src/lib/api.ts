import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    // Try zustand storage first, fallback to localStorage token
    let token: string | null = null;
    try {
      const raw = localStorage.getItem("timetable-auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        token = parsed?.state?.token ?? null;
      }
    } catch {}
    if (!token) token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      try {
        localStorage.removeItem("timetable-auth");
      } catch {}
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// --- Auth ---
export const login = (data: { username: string; password: string }) =>
  api.post("/api/auth/login", data);

export const register = (data: {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}) => api.post("/api/auth/register", data);

export const getMe = () => api.get("/api/auth/me");

// --- Courses ---
export const getCourses = (params?: {
  department_id?: number;
  department?: string;
  semester?: number | string;
  is_lab?: boolean;
  skip?: number;
  limit?: number;
}) => api.get("/api/v1/courses", { params });

export const getCourse = (id: number) => api.get(`/api/v1/courses/${id}`);

export const createCourse = (data: Record<string, unknown>) =>
  api.post("/api/v1/courses", data);

export const updateCourse = (id: number, data: Record<string, unknown>) =>
  api.put(`/api/v1/courses/${id}`, data);

export const deleteCourse = (id: number) =>
  api.delete(`/api/v1/courses/${id}`);

// --- Faculty ---
export const getFaculty = (params?: {
  department_id?: number;
  department?: string;
  semester?: string;
  course_ids?: string;
  skip?: number;
  limit?: number;
}) => api.get("/api/v1/faculty", { params });

export const getFacultyMember = (id: number) => api.get(`/api/v1/faculty/${id}`);

export const createFaculty = (data: Record<string, unknown>) =>
  api.post("/api/v1/faculty", data);

export const updateFaculty = (id: number, data: Record<string, unknown>) =>
  api.put(`/api/v1/faculty/${id}`, data);

export const deleteFaculty = (id: number) =>
  api.delete(`/api/v1/faculty/${id}`);

// --- Sections ---
export const getSections = (params?: { skip?: number; limit?: number }) =>
  api.get("/api/v1/sections", { params });

export const getSection = (id: number) => api.get(`/api/v1/sections/${id}`);

export const createSection = (data: Record<string, unknown>) =>
  api.post("/api/v1/sections", data);

export const updateSection = (id: number, data: Record<string, unknown>) =>
  api.put(`/api/v1/sections/${id}`, data);

export const deleteSection = (id: number) =>
  api.delete(`/api/v1/sections/${id}`);

// --- Rooms ---
export const getRooms = (params?: { skip?: number; limit?: number }) =>
  api.get("/api/v1/rooms", { params });

export const getRoom = (id: number) => api.get(`/api/v1/rooms/${id}`);

export const createRoom = (data: Record<string, unknown>) =>
  api.post("/api/v1/rooms", data);

export const updateRoom = (id: number, data: Record<string, unknown>) =>
  api.put(`/api/v1/rooms/${id}`, data);

export const deleteRoom = (id: number) => api.delete(`/api/v1/rooms/${id}`);

// --- Time Slots ---
export const getTimeSlots = (params?: { skip?: number; limit?: number }) =>
  api.get("/api/v1/time-slots", { params });

export const getTimeSlot = (id: number) =>
  api.get(`/api/v1/time-slots/${id}`);

export const createTimeSlot = (data: Record<string, unknown>) =>
  api.post("/api/v1/time-slots", data);

export const updateTimeSlot = (id: number, data: Record<string, unknown>) =>
  api.put(`/api/v1/time-slots/${id}`, data);

export const deleteTimeSlot = (id: number) =>
  api.delete(`/api/v1/time-slots/${id}`);

// --- Timetable Generation ---
export const generateTimetable = (data: {
  name?: string;
  sections?: number[];
  rooms?: number[];
  faculty?: number[];
  courses?: number[];
  department_id?: number;
  department?: string;
  semester?: number | string;
  time_start?: string;
  time_end?: string;
  num_sections?: number;
  num_rooms?: number;
  optimize?: boolean;
  max_iterations?: number;
}) => api.post("/api/v1/timetable/generate", data);

// --- Departments & Semesters ---
export const getDepartments = () => api.get("/api/v1/departments");
export const getSemesters = (departmentId?: number | string, department?: string) =>
  api.get("/api/v1/semesters", {
    params: {
      ...(departmentId ? { department_id: departmentId } : {}),
      ...(department ? { department } : {}),
    },
  });

// --- Institution metadata ---
export const getInstitutionMetadata = () =>
  api.get("/api/v1/institution-metadata");

// --- Timetables ---
export const getTimetables = (params?: { skip?: number; limit?: number }) =>
  api.get("/api/v1/timetables", { params });

export const getTimetable = (id: number) =>
  api.get(`/api/v1/timetables/${id}`);

export const getTimetableEntries = (id: number) =>
  api.get(`/api/v1/timetables/${id}/entries`);

export const deleteTimetable = (id: number) =>
  api.delete(`/api/v1/timetables/${id}`);

export const finalizeTimetable = (id: number) =>
  api.put(`/api/v1/timetables/${id}/finalize`);

// --- Validation ---
export const validateTimetable = (timetableId: number) =>
  api.post(`/api/v1/validate?timetable_id=${timetableId}`);

// --- Analytics ---
export const getAnalytics = (timetableId?: number) =>
  api.get("/api/v1/analytics", {
    params: timetableId ? { timetable_id: timetableId } : undefined,
  });

// --- Faculty / Section / Room Timetables ---
export const getFacultyTimetable = (facultyId: number, timetableId?: number) =>
  api.get(`/api/v1/faculty/${facultyId}/timetable`, {
    params: timetableId ? { timetable_id: timetableId } : undefined,
  });

export const getSectionTimetable = (sectionId: number, timetableId?: number) =>
  api.get(`/api/v1/sections/${sectionId}/timetable`, {
    params: timetableId ? { timetable_id: timetableId } : undefined,
  });

export const getRoomTimetable = (roomId: number, timetableId?: number) =>
  api.get(`/api/v1/rooms/${roomId}/timetable`, {
    params: timetableId ? { timetable_id: timetableId } : undefined,
  });
