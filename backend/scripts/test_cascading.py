"""Comprehensive test for Excel import and Cascading Selection APIs with real Excel data."""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.models.base import Department, Course, Faculty, Section, Room
from scripts.import_excel import import_excel_data

def run_tests():
    print("=" * 70)
    print("STEP 1: Testing Excel Importer with Real timetable.xlsx (BE Subjects)")
    print("=" * 70)
    
    excel_path = os.path.join(os.path.dirname(__file__), "..", "data", "timetable.xlsx")
    assert os.path.exists(excel_path), f"Excel file not found at {excel_path}"
    
    init_db()
    db = SessionLocal()
    try:
        # 1. Run importer with clear_existing=True
        res = import_excel_data(excel_path, db, clear_existing=True)
        print("Import Result:", res["message"])
        assert res["success"] is True, f"Importer failed: {res['message']}"
        print("Import Counts:", res["counts"])
        print("Warnings reported:", len(res["warnings"]))
        for w in res["warnings"]:
            print(f"  [Expected Warning] {w}")
        
        # Verify imported counts match Excel data
        assert res["counts"]["departments"] == 4, f"Expected 4 departments, got {res['counts']['departments']}"
        assert res["counts"]["courses"] == 165, f"Expected 165 courses, got {res['counts']['courses']}"
        
        # 2. Test idempotency (run again without clear_existing)
        print("\nTesting Importer Idempotency (running second time)...")
        res_idempotent = import_excel_data(excel_path, db, clear_existing=False)
        assert res_idempotent["success"] is True, "Second import run failed"
        print("Idempotent Run Counts:", res_idempotent["counts"])
        
        # DB counts after idempotent run
        dept_count = db.query(Department).count()
        course_count = db.query(Course).count()
        assert dept_count == 4, f"Duplicate departments created! Expected 4, got {dept_count}"
        assert course_count == 165, f"Duplicate courses created! Expected 165, got {course_count}"
        print(f"Verified DB state: {dept_count} departments, {course_count} courses.")
    finally:
        db.close()
    
    print("\n" + "=" * 70)
    print("STEP 2: Testing Cascading APIs with TestClient")
    print("=" * 70)
    
    client = TestClient(app)
    
    # 1. Test GET /api/v1/departments
    print("\n[TEST 1] GET /api/v1/departments")
    dept_res = client.get("/api/v1/departments")
    assert dept_res.status_code == 200, f"Failed: {dept_res.text}"
    departments = dept_res.json()
    print(f"Found {len(departments)} departments:")
    dept_names = [d["name"] for d in departments]
    for d in departments:
        print(f"  - ID: {d['id']}, Name: {d['name']}")
    
    expected_depts = [
        "Civil Engineering",
        "Computer Engineering",
        "Electrical Engineering",
        "Mechanical Engineering"
    ]
    assert sorted(dept_names) == sorted(expected_depts), f"Mismatch in departments! Got {dept_names}"
    
    comp_dept = next((d for d in departments if d["name"] == "Computer Engineering"), None)
    civil_dept = next((d for d in departments if d["name"] == "Civil Engineering"), None)
    elec_dept = next((d for d in departments if d["name"] == "Electrical Engineering"), None)
    mech_dept = next((d for d in departments if d["name"] == "Mechanical Engineering"), None)
    
    assert comp_dept is not None
    assert civil_dept is not None
    assert elec_dept is not None
    assert mech_dept is not None
    
    # 2. Test GET /api/v1/semesters?department_id=
    print(f"\n[TEST 2] GET /api/v1/semesters?department_id={comp_dept['id']} (Computer Engineering)")
    comp_sem_res = client.get(f"/api/v1/semesters?department_id={comp_dept['id']}")
    assert comp_sem_res.status_code == 200
    comp_sems = comp_sem_res.json()
    comp_sem_names = [s["semester"] for s in comp_sems]
    print("Computer Engineering Semesters:", comp_sem_names)
    expected_sems = ['Semester 1 & 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8']
    assert comp_sem_names == expected_sems, f"Mismatch in semesters: {comp_sem_names}"
    
    # 3. Test GET /api/v1/courses?department_id= & semester= (Authoritative Filtering)
    print(f"\n[TEST 3] GET /api/v1/courses?department_id={comp_dept['id']}&semester=Semester 5 (Computer Engineering Semester 5)")
    comp_5_res = client.get(f"/api/v1/courses?department_id={comp_dept['id']}&semester=Semester 5")
    assert comp_5_res.status_code == 200
    comp_5_courses = comp_5_res.json()
    print(f"Computer Engineering Semester 5 courses count: {len(comp_5_courses)}")
    for c in comp_5_courses:
        print(f"  - {c['code']} : {c['name']} (Sem '{c.get('semester')}', Dept ID {c.get('department_id')})")
        assert c.get("semester") == "Semester 5"
        assert c.get("department_id") == comp_dept["id"]
    
    comp_5_codes = {c["code"]: c["name"] for c in comp_5_courses}
    assert "3150710" in comp_5_codes and comp_5_codes["3150710"] == "Computer Networks"
    assert "3150711" in comp_5_codes and comp_5_codes["3150711"] == "Software Engineering"
    assert "3150712" in comp_5_codes and comp_5_codes["3150712"] == "Computer Graphics"
    assert "3150713" in comp_5_codes and comp_5_codes["3150713"] == "Python for Data Science"
    assert "3150714" in comp_5_codes and comp_5_codes["3150714"] == "Cyber Security"
    
    # 4. Test Civil Engineering Semester 5
    print(f"\n[TEST 4] GET /api/v1/courses?department_id={civil_dept['id']}&semester=Semester 5 (Civil Engineering Semester 5)")
    civil_5_res = client.get(f"/api/v1/courses?department_id={civil_dept['id']}&semester=Semester 5")
    assert civil_5_res.status_code == 200
    civil_5_courses = civil_5_res.json()
    print(f"Civil Engineering Semester 5 courses count: {len(civil_5_courses)}")
    for c in civil_5_courses:
        print(f"  - {c['code']} : {c['name']} (Sem '{c.get('semester')}', Dept ID {c.get('department_id')})")
        assert c.get("semester") == "Semester 5"
        assert c.get("department_id") == civil_dept["id"]
    
    civil_5_codes = {c["code"]: c["name"] for c in civil_5_courses}
    assert "3150610" in civil_5_codes and civil_5_codes["3150610"] == "Concrete Technology"
    assert "3150611" in civil_5_codes and civil_5_codes["3150611"] == "Transportation Engineering"
    
    # 5. Strict Isolation: Verify Computer Engineering Sem 5 has 0 intersection with Civil Engineering Sem 5
    print("\n[TEST 5] Verifying Strict Department Isolation between Computer Engineering and Civil Engineering")
    common_codes = set(comp_5_codes.keys()).intersection(set(civil_5_codes.keys()))
    assert len(common_codes) == 0, f"Isolation failure! Common codes in Sem 5: {common_codes}"
    print("[OK] Department isolation verified: 0 overlapping subject codes.")
    
    print("\n" + "=" * 70)
    print("ALL TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
