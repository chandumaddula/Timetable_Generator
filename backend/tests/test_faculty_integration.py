"""Test Faculty data-directed integration end-to-end."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.base import Department, Course, Faculty

client = TestClient(app)


def test_1_excel_import_faculty_records():
    """TEST 1: Run Excel import. Faculty records are created/updated."""
    db = SessionLocal()
    fac_count = db.query(Faculty).count()
    course_with_fac = db.query(Course).filter(Course.faculty_id.isnot(None)).count()
    db.close()
    assert fac_count >= 16, f"Expected at least 16 faculty, got {fac_count}"
    assert course_with_fac >= 165, f"Expected at least 165 courses with faculty, got {course_with_fac}"


def test_2_select_department_semesters():
    """TEST 2: Open Generate Timetable. Select: Computer Engineering -> Relevant semesters appear."""
    depts = client.get("/api/v1/departments").json()
    comp_dept = next(d for d in depts if d["name"] == "Computer Engineering")
    sem_res = client.get(f"/api/v1/semesters?department_id={comp_dept['id']}").json()
    sem_names = [s["semester"] for s in sem_res]
    assert any("Semester 1 & 2" in s for s in sem_names)


def test_3_select_semester_subjects():
    """TEST 3: Select: Semester 1 & 2 -> Correct subjects appear."""
    depts = client.get("/api/v1/departments").json()
    comp_dept = next(d for d in depts if d["name"] == "Computer Engineering")
    courses_res = client.get(f"/api/v1/courses?department_id={comp_dept['id']}&semester=Semester 1 & 2").json()
    course_names = [c["name"] for c in courses_res]
    assert "Programming for Problem Solving" in course_names
    assert "English" in course_names
    assert "Basic Civil Engineering" in course_names


def test_4_faculty_dropdown_not_empty():
    """TEST 4: Open Faculty dropdown -> Actual faculty names from Excel appear, not empty."""
    depts = client.get("/api/v1/departments").json()
    comp_dept = next(d for d in depts if d["name"] == "Computer Engineering")
    fac_res = client.get(f"/api/v1/faculty?department_id={comp_dept['id']}").json()
    fac_names = [f["name"] for f in fac_res]
    assert len(fac_names) >= 4
    assert "Prof. Arjun Mehta" in fac_names
    assert "Prof. Priya Desai" in fac_names
    assert "Prof. Rohan Shah" in fac_names
    assert "Prof. Kavita Patel" in fac_names


def test_5_change_department_faculty():
    """TEST 5: Change department: Computer Engineering -> Electrical Engineering -> Faculty list changes."""
    depts = client.get("/api/v1/departments").json()
    ee_dept = next(d for d in depts if d["name"] == "Electrical Engineering")
    ee_fac_res = client.get(f"/api/v1/faculty?department_id={ee_dept['id']}").json()
    ee_fac_names = [f["name"] for f in ee_fac_res]
    assert "Prof. Rahul Joshi" in ee_fac_names
    assert "Prof. Sneha Shah" in ee_fac_names
    assert "Prof. Kiran Patel" in ee_fac_names
    assert "Prof. Anjali Mehta" in ee_fac_names
    assert "Prof. Arjun Mehta" not in ee_fac_names


def test_6_change_semester_faculty():
    """TEST 6: Change semester -> Faculty list refreshes according to course configuration."""
    depts = client.get("/api/v1/departments").json()
    comp_dept = next(d for d in depts if d["name"] == "Computer Engineering")
    ce_sem3_courses = client.get(f"/api/v1/courses?department_id={comp_dept['id']}&semester=Semester 3").json()
    ce_sem3_c_ids = ",".join(str(c["id"]) for c in ce_sem3_courses)
    ce_sem3_fac = client.get(f"/api/v1/faculty?course_ids={ce_sem3_c_ids}").json()
    assert len(ce_sem3_fac) > 0


def test_7_select_specific_subjects_faculty():
    """TEST 7: Select specific subjects -> Faculty associated with those subjects can be selected."""
    depts = client.get("/api/v1/departments").json()
    comp_dept = next(d for d in depts if d["name"] == "Computer Engineering")
    courses_res = client.get(f"/api/v1/courses?department_id={comp_dept['id']}&semester=Semester 1 & 2").json()
    pps = next(c for c in courses_res if c["name"] == "Programming for Problem Solving")
    eng = next(c for c in courses_res if c["name"] == "English")
    specific_fac_res = client.get(f"/api/v1/faculty?course_ids={pps['id']},{eng['id']}").json()
    specific_fac_names = [f["name"] for f in specific_fac_res]
    assert pps["faculty"]["name"] in specific_fac_names
    assert eng["faculty"]["name"] in specific_fac_names


def test_8_generate_timetable_with_dsatur():
    """TEST 8: Generate timetable -> Selected faculty is passed into generation system and DSATUR works."""
    depts = client.get("/api/v1/departments").json()
    comp_dept = next(d for d in depts if d["name"] == "Computer Engineering")
    courses_res = client.get(f"/api/v1/courses?department_id={comp_dept['id']}&semester=Semester 1 & 2").json()
    pps = next(c for c in courses_res if c["name"] == "Programming for Problem Solving")
    eng = next(c for c in courses_res if c["name"] == "English")
    specific_fac_res = client.get(f"/api/v1/faculty?course_ids={pps['id']},{eng['id']}").json()
    selected_fac_ids = [f["id"] for f in specific_fac_res]

    gen_payload = {
        "name": "Test Timetable CE Sem 1&2",
        "department_id": comp_dept["id"],
        "semester": "Semester 1 & 2",
        "courses": [pps["id"], eng["id"]],
        "faculty": selected_fac_ids,
        "time_start": "08:00",
        "time_end": "17:00",
        "num_sections": 1,
        "num_rooms": 2,
        "optimize": True,
    }
    gen_res = client.post("/api/v1/timetable/generate", json=gen_payload).json()
    assert gen_res.get("timetable_id") is not None
    assert gen_res.get("assignments_count") > 0
    assert gen_res.get("success") is True


def test_9_sequential_section_generation_no_clashes():
    """TEST 9: Generate Section A, then Section B sequentially -> Section B has valid section data, distinct times, and zero clashes."""
    depts = client.get("/api/v1/departments").json()
    ee_dept = next(d for d in depts if d["name"] == "Electrical Engineering")
    courses_res = client.get(f"/api/v1/courses?department_id={ee_dept['id']}&semester=Semester 5").json()
    course_ids = [c["id"] for c in courses_res]
    fac_res = client.get(f"/api/v1/faculty?department_id={ee_dept['id']}").json()
    fac_ids = [f["id"] for f in fac_res]

    # 1. Generate Section A
    gen_a_payload = {
        "name": "Electrical Engineering - Semester Semester 5 (Section A)",
        "department_id": ee_dept["id"],
        "semester": "Semester 5",
        "courses": course_ids,
        "faculty": fac_ids,
        "time_start": "08:00",
        "time_end": "17:00",
        "num_sections": 15,
        "num_rooms": 16,
        "selected_section": "A",
        "optimize": True,
    }
    res_a = client.post("/api/v1/timetable/generate", json=gen_a_payload).json()
    assert res_a["success"] is True
    tt_id = res_a["timetable_id"]
    assert res_a["assignments_count"] == 12

    # 2. Generate Section B into the same timetable
    gen_b_payload = {
        "timetable_id": tt_id,
        "name": "Electrical Engineering - Semester Semester 5 (Section B)",
        "department_id": ee_dept["id"],
        "semester": "Semester 5",
        "courses": course_ids,
        "faculty": fac_ids,
        "time_start": "08:00",
        "time_end": "17:00",
        "num_sections": 15,
        "num_rooms": 16,
        "selected_section": "B",
        "completed_sections": ["A"],
        "optimize": True,
    }
    res_b = client.post("/api/v1/timetable/generate", json=gen_b_payload).json()
    assert res_b["success"] is True
    assert res_b["assignments_count"] == 12
    assert res_b["total_entries_count"] == 24

    # 3. Query timetable entries
    entries = client.get(f"/api/v1/timetables/{tt_id}/entries").json()
    assert len(entries) == 24

    entries_a = [e for e in entries if e.get("section") and e["section"].get("section_number") == "A"]
    entries_b = [e for e in entries if e.get("section") and e["section"].get("section_number") == "B"]
    assert len(entries_a) == 12, f"Expected 12 entries for Section A, got {len(entries_a)}"
    assert len(entries_b) == 12, f"Expected 12 entries for Section B, got {len(entries_b)}"

    # 4. Check zero faculty clashes across Section A and Section B
    fac_slots_a = {(e["faculty_id"], e["time_slot_id"]) for e in entries_a if e.get("faculty_id")}
    fac_slots_b = {(e["faculty_id"], e["time_slot_id"]) for e in entries_b if e.get("faculty_id")}
    assert len(fac_slots_a.intersection(fac_slots_b)) == 0, "Cross-section faculty clash detected!"

    # 5. Check zero room clashes across Section A and Section B
    room_slots_a = {(e["room_id"], e["time_slot_id"]) for e in entries_a if e.get("room_id")}
    room_slots_b = {(e["room_id"], e["time_slot_id"]) for e in entries_b if e.get("room_id")}
    assert len(room_slots_a.intersection(room_slots_b)) == 0, "Cross-section room clash detected!"

