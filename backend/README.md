# Timetable Generator API

Automated timetable generation backend using **DSATUR graph coloring** and constraint-based scheduling.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Seed the database with sample data
python seed_data.py

# Run the server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest tests/ -v
```

The API is available at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

## Architecture

```
app/
  algorithms/
    graph.py       - ConflictGraph (adjacency list), SessionNode
    coloring.py   - DSATUR implementation, time-slot mapping
    scheduler.py  - TimetableScheduler (orchestrates generation)
  constraints/
    __init__.py   - ConstraintEngine + 14 hard/soft constraint rules
  validators/
    __init__.py   - TimetableValidator (scoring + validation)
  models/
    base.py       - SQLAlchemy ORM models (Faculty, Course, Section, Room, TimeSlot…)
  api/
    v1.py         - REST endpoints (courses, faculty, rooms, time-slots, generation)
    auth.py       - JWT authentication
  schemas.py      - Pydantic request/response schemas
  database.py     - SQLite + async session management
  main.py         - FastAPI application entry point
```

## Algorithm

### Step 1: Session Expansion
Each `(course, section)` pair is expanded into N session nodes (one per `periods_per_week`).

### Step 2: Conflict Graph
A graph is built where an edge between two sessions means they **cannot share a time slot**:
- Same faculty (faculty teaches two things at once)
- Same section (a section attends two things at once)

The chromatic number of this graph is the **minimum number of time slots required**.

### Step 3: DSATUR Graph Coloring
[DSATUR](https://en.wikipedia.org/wiki/DSATUR) (Degree of Saturation) colors the conflict graph:
- At each step, the vertex with the most distinct colors already assigned to neighbors is chosen
- Tie-broken by highest degree

DSATUR is used instead of the basic Welsh-Powell algorithm because it is significantly more effective for sparse graphs — which academic timetables typically are (density ≈ 5%, meaning most sessions are independent of each other).

### Step 4: Time-Slot Assignment
Colors are mapped to actual `TimeSlot` IDs, preferring slots where:
- The faculty is not explicitly unavailable
- Sessions of the same section/faculty land in different slots
- Multiple sessions in the same color group use different slots (spreading load)

### Step 5: Room Assignment
Per time slot, rooms are greedily assigned:
1. **Lab sessions** get priority for `room_type="lab"` rooms
2. Capacity must meet section enrollment
3. Fallback relaxes projector/lab requirements, then capacity, to ensure every session gets a room

### Step 6: Validation
All 14 constraints are checked:
| Code | Severity | Description |
|------|----------|-------------|
| `faculty_overlap` | HARD | Faculty assigned to 2+ sections at same slot |
| `section_overlap` | HARD | Section in 2+ rooms at same slot |
| `room_overlap` | HARD | Room hosts 2+ classes at same slot |
| `faculty_unavailable` | HARD | Faculty assigned to a slot they marked unavailable |
| `room_unavailable` | HARD | Room assigned to a slot it is unavailable |
| `room_capacity` | HARD | Room capacity < section enrollment |
| `lab_required` | HARD | Lab session in a non-lab room |
| `break_slot` | HARD | Class scheduled during a break slot |
| `under_target_periods` | HARD | Section gets fewer periods than minimum |
| `faculty_gap` | SOFT | Faculty has idle gap between classes on same day |
| `student_gap` | SOFT | Section has idle gap between classes on same day |
| `consecutive_missing` | SOFT | Course sessions are not back-to-back |
| `workload_exceeded` | SOFT | Faculty scheduled > `max_hours_per_week` |
| `late_class` | SOFT | Class scheduled after 17:00 |

**Score**: `100 - hard×20 - soft×3` (0–100, clamped)

### Step 7: Local Search Optimization
If `optimize=true`, a hill-climbing local search swaps time slots between assignments to improve the score. Swaps that would introduce hard violations are rejected.

## API Endpoints

### Core
- `GET /health` — Health check
- `GET /api/v1/courses` — List courses
- `GET /api/v1/faculty` — List faculty
- `GET /api/v1/sections` — List sections
- `GET /api/v1/rooms` — List rooms
- `GET /api/v1/time-slots` — List time slots

### Generation
- `POST /api/v1/timetable/generate` — Generate a timetable
  ```json
  {
    "name": "Fall 2025",
    "sections": [1, 2, 3, 4],   // optional filter
    "optimize": true,
    "max_iterations": 500
  }
  ```
  Response:
  ```json
  {
    "timetable_id": 1,
    "success": true,
    "message": "Timetable generated successfully.",
    "validation": {
      "valid": true,
      "score": 58.0,
      "hard_violations": 0,
      "soft_violations": 14
    },
    "assignments_count": 8
  }
  ```

### Validation
- `POST /api/v1/validate?timetable_id=1` — Validate an existing timetable

### Analytics
- `GET /api/v1/analytics?timetable_id=1` — Utilization statistics
- `GET /api/v1/faculty/{id}/timetable` — Faculty schedule
- `GET /api/v1/sections/{id}/timetable` — Section schedule
- `GET /api/v1/rooms/{id}/timetable` — Room schedule

### Authentication
- `POST /api/auth/login` — Get JWT token
- `POST /api/auth/register` — Create user

## Testing

```bash
pytest tests/ -v
```

**30 tests** covering:
- `test_graph.py` — Conflict graph construction, DSATUR correctness, greedy coloring
- `test_scheduler.py` — Scheduler integration, faculty/section/room conflicts
- `test_constraints.py` — All 14 constraint types (hard + soft)

## Seed Data

Run `python seed_data.py` to populate the database with:
- 20 courses (some labs)
- 14 faculty members
- 16 sections
- 10 rooms (3 lab, 3 tutorial, 4 lecture)
- 35 time slots (30 class + 5 break)
- Faculty availability constraints
- Faculty preferences

## Known Limitations

- With 39+ sessions and only 10 rooms, the seeded data is **over-constrained**. Try generating for sections 1–4 for a guaranteed-valid timetable:
  ```bash
  curl -X POST http://localhost:8000/api/v1/timetable/generate \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","sections":[1,2,3,4],"optimize":false}'
  ```
- The DSATUR chromatic number is a **lower bound** on slots needed; actual feasible schedules may require more slots due to room constraints and availability records.
