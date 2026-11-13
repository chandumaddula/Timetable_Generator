"""Tests for manual editing of timetable entries (timings, faculty, subject, room)."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.base import Timetable, TimetableEntry, Course, Faculty, Room, TimeSlot, Section

client = TestClient(app)

def test_manual_timetable_entry_update_and_delete():
    # 1. Fetch available entities
    db = SessionLocal()
    course1 = db.query(Course).first()
    course2 = db.query(Course).filter(Course.id != course1.id).first()
    faculty1 = db.query(Faculty).first()
    faculty2 = db.query(Faculty).filter(Faculty.id != faculty1.id).first()
    room1 = db.query(Room).first()
    room2 = db.query(Room).filter(Room.id != room1.id).first()
    slot1 = db.query(TimeSlot).first()
    slot2 = db.query(TimeSlot).filter(TimeSlot.id != slot1.id).first()
    section = db.query(Section).first()
    
    c1_id = course1.id
    c2_id = course2.id
    f1_id = faculty1.id
    f2_id = faculty2.id
    r1_id = room1.id
    r2_id = room2.id
    s1_id = slot1.id
    s2_id = slot2.id
    sec_id = section.id
    
    # Create or get a test timetable
    tt = db.query(Timetable).first()
    if not tt:
        tt = Timetable(name="Manual Edit Test Timetable", version=1)
        db.add(tt)
        db.commit()
        db.refresh(tt)
    
    timetable_id = tt.id
    
    # Create a test entry
    entry = TimetableEntry(
        timetable_id=timetable_id,
        course_id=c1_id,
        faculty_id=f1_id,
        room_id=r1_id,
        time_slot_id=s1_id,
        section_id=sec_id,
        entry_type="class",
        is_primary=True,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    entry_id = entry.id
    db.close()

    try:
        # 2. Update the entry (change timing, faculty, subject, and room)
        update_payload = {
            "course_id": c2_id,
            "faculty_id": f2_id,
            "room_id": r2_id,
            "time_slot_id": s2_id,
        }
        res = client.put(f"/api/v1/timetables/{timetable_id}/entries/{entry_id}", json=update_payload)
        assert res.status_code == 200, res.text
        updated = res.json()
        assert updated["course_id"] == c2_id
        assert updated["faculty_id"] == f2_id
        assert updated["room_id"] == r2_id
        assert updated["time_slot_id"] == s2_id

        # 3. Delete the entry
        del_res = client.delete(f"/api/v1/timetables/{timetable_id}/entries/{entry_id}")
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

        # 4. Verify 404 after deletion
        get_res = client.put(f"/api/v1/timetables/{timetable_id}/entries/{entry_id}", json=update_payload)
        assert get_res.status_code == 404
    finally:
        # Cleanup if needed
        db = SessionLocal()
        existing = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
        if existing:
            db.delete(existing)
            db.commit()
        db.close()


def test_section_editing_and_conflict_prevention():
    """Verify that section can be edited and conflicts (section, faculty, room) are prevented."""
    db = SessionLocal()
    courses = db.query(Course).all()
    faculty_list = db.query(Faculty).all()
    rooms = db.query(Room).all()
    slots = db.query(TimeSlot).filter(TimeSlot.is_break == False).all()
    
    c1, c2 = courses[0], courses[1]
    f1, f2 = faculty_list[0], faculty_list[1]
    r1, r2 = rooms[0], rooms[1]
    s1, s2 = slots[0], slots[1]
    
    tt = db.query(Timetable).first()
    if not tt:
        tt = Timetable(name="Section Edit Conflict Test", version=1)
        db.add(tt)
        db.commit()
        db.refresh(tt)
    timetable_id = tt.id
    
    # Clean any entries for this test
    db.query(TimetableEntry).filter(TimetableEntry.timetable_id == timetable_id).delete()
    db.commit()
    db.close()

    # 1. Create entry for Section A
    res_a = client.post(f"/api/v1/timetables/{timetable_id}/entries", json={
        "course_id": c1.id,
        "faculty_id": f1.id,
        "room_id": r1.id,
        "time_slot_id": s1.id,
        "section_name": "A"
    })
    assert res_a.status_code == 200, res_a.text
    entry_a_id = res_a.json()["id"]

    # 2. Attempt to create another class for Section A at the same slot s1 -> 400 Section Conflict
    res_clash = client.post(f"/api/v1/timetables/{timetable_id}/entries", json={
        "course_id": c2.id,
        "faculty_id": f2.id,
        "room_id": r2.id,
        "time_slot_id": s1.id,
        "section_name": "A"
    })
    assert res_clash.status_code == 400
    assert "Section conflict" in res_clash.json()["detail"]

    # 3. Create entry for Section B at the same slot s1 (with distinct faculty and room) -> 200 OK
    res_b = client.post(f"/api/v1/timetables/{timetable_id}/entries", json={
        "course_id": c2.id,
        "faculty_id": f2.id,
        "room_id": r2.id,
        "time_slot_id": s1.id,
        "section_name": "B"
    })
    assert res_b.status_code == 200, res_b.text
    entry_b_id = res_b.json()["id"]

    # 4. Attempt to edit Section B entry to Section A at slot s1 -> 400 Conflict (Section A already busy)
    res_edit_clash = client.put(f"/api/v1/timetables/{timetable_id}/entries/{entry_b_id}", json={
        "section_name": "A"
    })
    assert res_edit_clash.status_code == 400
    assert "Section conflict" in res_edit_clash.json()["detail"]

    # 5. Edit Section B entry to slot s2 and change Section to C -> 200 OK (no conflict at slot s2)
    res_edit_ok = client.put(f"/api/v1/timetables/{timetable_id}/entries/{entry_b_id}", json={
        "time_slot_id": s2.id,
        "section_name": "C"
    })
    assert res_edit_ok.status_code == 200
    db = SessionLocal()
    updated_sec = db.query(Section).filter(Section.id == res_edit_ok.json()["section_id"]).first()
    assert updated_sec.section_number == "C"

    # Cleanup
    db.query(TimetableEntry).filter(TimetableEntry.timetable_id == timetable_id).delete()
    db.commit()
    db.close()
