"""Comprehensive test for Excel import and Cascading Selection APIs."""
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
    print("=" * 60)
    print("STEP 1: Testing Excel Importer")
    print("=" * 60)
    
    excel_path = os.path.join(os.path.dirname(__file__), "..", "data", "timetable.xlsx")
    assert os.path.exists(excel_path), f"Excel file not found at {excel_path}"
    
    init_db()
    db = SessionLocal()
    try:
        # Run importer with clear_existing=True
        res = import_excel_data(excel_path, db, clear_existing=True)
        print("Import Result:", res["message"])
        assert res["success"] is True, "Importer failed"
        
        # Test idempotency (run again without clear_existing)
        print("\nTesting Importer Idempotency (running second time)...")
        res_idempotent = import_excel_data(excel_path, db, clear_existing=False)
        assert res_idempotent["success"] is True, "Second import run failed"
        print("Idempotent Run Counts:", res_idempotent["counts"])
    finally:
        db.close()
    
    print("\n" + "=" * 60)
    print("STEP 2: Testing Cascading APIs with TestClient")
    print("=" * 60)
    
    client = TestClient(app)
    
    # 1. Test GET /api/v1/departments
    print("\n[TEST] GET /api/v1/departments")
    dept_res = client.get("/api/v1/departments")
    assert dept_res.status_code == 200, f"Failed: {dept_res.text}"
    departments = dept_res.json()
    print(f"Found {len(departments)} departments:")
    for d in departments:
        print(f"  - ID: {d['id']}, Name: {d['name']}, Code: {d.get('code')}")
    assert len(departments) >= 2, "Expected at least 2 departments"
    
    cse_dept = next((d for d in departments if "Computer Science" in d["name"] or d.get("code") == "CSE"), None)
    ee_dept = next((d for d in departments if "Electrical" in d["name"] or d.get("code") == "EE"), None)
    assert cse_dept is not None, "CSE department not found"
    assert ee_dept is not None, "EE department not found"
    
    cse_id = cse_dept["id"]
    ee_id = ee_dept["id"]
    
    # 2. Test GET /api/v1/semesters?department_id=
    print(f"\n[TEST] GET /api/v1/semesters?department_id={cse_id} (CSE)")
    cse_sem_res = client.get(f"/api/v1/semesters?department_id={cse_id}")
    assert cse_sem_res.status_code == 200
    cse_sems = cse_sem_res.json()
    print("CSE Semesters:", [s["semester"] for s in cse_sems])
    assert len(cse_sems) > 0, "No semesters returned for CSE"
    
    print(f"\n[TEST] GET /api/v1/semesters?department_id={ee_id} (EE)")
    ee_sem_res = client.get(f"/api/v1/semesters?department_id={ee_id}")
    assert ee_sem_res.status_code == 200
    ee_sems = ee_sem_res.json()
    print("EE Semesters:", [s["semester"] for s in ee_sems])
    assert len(ee_sems) > 0, "No semesters returned for EE"
    
    # 3. Test GET /api/v1/courses?department_id= & semester= (Authoritative Filtering)
    print(f"\n[TEST] GET /api/v1/courses?department_id={cse_id}&semester=5 (CSE Semester 5)")
    cse_5_res = client.get(f"/api/v1/courses?department_id={cse_id}&semester=5")
    assert cse_5_res.status_code == 200
    cse_5_courses = cse_5_res.json()
    print(f"CSE Semester 5 courses count: {len(cse_5_courses)}")
    for c in cse_5_courses:
        print(f"  - {c['code']} : {c['name']} (Sem {c.get('semester')}, Dept ID {c.get('department_id')})")
        assert c.get("semester") == 5, f"Course {c['code']} semester is not 5"
        assert c.get("department_id") == cse_id, f"Course {c['code']} department_id is not {cse_id}"
    
    print(f"\n[TEST] GET /api/v1/courses?department_id={ee_id}&semester=5 (EE Semester 5)")
    ee_5_res = client.get(f"/api/v1/courses?department_id={ee_id}&semester=5")
    assert ee_5_res.status_code == 200
    ee_5_courses = ee_5_res.json()
    print(f"EE Semester 5 courses count: {len(ee_5_courses)}")
    for c in ee_5_courses:
        print(f"  - {c['code']} : {c['name']} (Sem {c.get('semester')}, Dept ID {c.get('department_id')})")
        assert c.get("semester") == 5, f"Course {c['code']} semester is not 5"
        assert c.get("department_id") == ee_id, f"Course {c['code']} department_id is not {ee_id}"
        
    # Verify isolation: CSE sem 5 courses are not in EE sem 5
    cse_codes = {c["code"] for c in cse_5_courses}
    ee_codes = {c["code"] for c in ee_5_courses}
    assert len(cse_codes.intersection(ee_codes)) == 0, "Department isolation failure: overlapping course codes"
    
    # 4. Test GET /api/v1/faculty filtering
    print(f"\n[TEST] GET /api/v1/faculty?department_id={cse_id}")
    fac_res = client.get(f"/api/v1/faculty?department_id={cse_id}")
    assert fac_res.status_code == 200
    cse_faculty = fac_res.json()
    print(f"Found {len(cse_faculty)} faculty members for CSE")
    assert len(cse_faculty) > 0
    
    # 5. Test Timetable Generation with filtered parameters
    print(f"\n[TEST] POST /api/v1/timetable/generate with cascading filters")
    course_ids = [c["id"] for c in cse_5_courses]
    fac_ids = [f["id"] for f in cse_faculty]
    gen_payload = {
        "name": "CSE Sem 5 Test Timetable",
        "department_id": cse_id,
        "department": cse_dept["name"],
        "semester": 5,
        "courses": course_ids,
        "faculty": fac_ids,
        "num_sections": 2,
        "num_rooms": 2,
        "optimize": True,
        "max_iterations": 200
    }
    gen_res = client.post("/api/v1/timetable/generate", json=gen_payload)
    assert gen_res.status_code == 200, f"Generation failed: {gen_res.text}"
    gen_data = gen_res.json()
    print(f"Generation Success: {gen_data['success']}")
    print(f"Assignments count: {gen_data['assignments_count']}")
    print(f"Validation score: {gen_data['validation']['score']}")
    print(f"Filter summary: {gen_data.get('filter_summary')}")
    assert gen_data["timetable_id"] > 0
    
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
