# Test Suite Architecture

## Component Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Test Suite Entry Points                       │
├──────────────────────────────────────────────────────────────────────┤
│  run_tests.sh (Bash)           run_tests.py (Python)                 │
│       │                                 │                             │
│       └─────────────┬───────────────────┘                             │
│                     ▼                                                 │
│              pytest test_process_v3_e2e.py                            │
└──────────────────────────────────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│  test_config.py  │      │ test_helpers.py  │
├──────────────────┤      ├──────────────────┤
│ • API_BASE_URL   │      │ TestAPIClient    │
│ • Timeouts       │      │ • authenticate() │
│ • Intervals      │      │ • create_pack()  │
│ • Status values  │      │ • upload()       │
│ • Paths          │      │ • poll_status()  │
└──────────────────┘      │                  │
                          │ PollingHelper    │
                          │ • wait_for_*()   │
                          │ • poll_until()   │
                          │                  │
                          │ AssertionHelper  │
                          │ • assert_*()     │
                          └──────────────────┘
                                    │
                                    ▼
                ┌───────────────────────────────────────────┐
                │    API Communication Flow                 │
                └───────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  Supabase    │          │   Backend    │          │   Storage    │
│  Auth & DB   │◄────────►│  FastAPI     │◄────────►│   R2/S3      │
└──────────────┘          └──────────────┘          └──────────────┘
```

## Test Execution Flow

```
START
  │
  ├─► test_01: Verify File ───────────────┐
  │                                        │
  ├─► test_02: Upload & Extract           │
  │      │                                 │
  │      ├─► Create Pack                   │
  │      ├─► Upload conversations.json    │
  │      ├─► Poll: processing             │
  │      └─► Wait: ready_for_analysis     │
  │                                        │
  ├─► test_03: Check Credits              │
  │                                        ├─► All pass?
  ├─► test_04: Analysis & Tree            │
  │      │                                 │
  │      ├─► Start analysis                │
  │      ├─► Poll: analyzing              │
  │      ├─► Poll: building_tree          │
  │      └─► Wait: completed              │
  │                                        │
  ├─► test_05: Polling Reliability        │
  │      └─► 5x consecutive polls         │
  │                                        │
  ├─► test_06: Final State                │
  │      └─► Verify data integrity        │
  │                                        │
  └─► END ◄──────────────────────────────┘
                 │
                 ├─► SUCCESS ✅
                 └─► FAILURE ❌
```

## Status Flow Diagram

```
┌─────────────┐
│   Upload    │
│    File     │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│   processing    │ ◄─── Extraction phase
│   (0-100%)      │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ ready_for_analysis  │ ◄─── Waiting for user/credit confirmation
└──────────┬──────────┘
           │
           │ start-analysis API call
           ▼
┌─────────────────┐
│    analyzing    │ ◄─── AI processing chunks
│    (10-90%)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ building_tree   │ ◄─── Memory tree extraction
│    (95-100%)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    completed    │ ◄─── Final state
│     (100%)      │
└─────────────────┘
```

## Test Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Input: conversations.json (Test Data)                       │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  EXTRACTION PHASE      │
        │  • Parse JSON          │
        │  • Extract text        │
        │  • Save to R2          │
        └────────┬───────────────┘
                 │
                 ▼ extracted.txt
        ┌────────────────────────┐
        │  CHUNKING PHASE        │
        │  • Split by tokens     │
        │  • Add overlap         │
        │  • Save chunks         │
        └────────┬───────────────┘
                 │
                 ▼ chunked.json (array of strings)
        ┌────────────────────────┐
        │  ANALYSIS PHASE        │
        │  • For each chunk:     │
        │    - OpenAI API call   │
        │    - Extract insights  │
        │    - Deduct credit     │
        │  • Batch concurrent    │
        └────────┬───────────────┘
                 │
                 ▼ analyzed.txt
        ┌────────────────────────┐
        │  TREE BUILDING PHASE   │
        │  • Parse analysis      │
        │  • Extract facts       │
        │  • Build hierarchy     │
        │  • Save to Supabase    │
        └────────┬───────────────┘
                 │
                 ▼ memory_tree (database)
        ┌────────────────────────┐
        │  COMPLETION            │
        │  • Status: completed   │
        │  • Progress: 100%      │
        │  • All data saved      │
        └────────────────────────┘
```

## Polling Strategy

```
Test starts polling
      │
      ▼
┌──────────────────────┐
│ Get current status   │◄─────┐
└──────┬───────────────┘      │
       │                      │
       ├─► Status = target? ──┴─► YES ─► Return success ✅
       │                            
       ├─► Status = failed? ───────► Return failure ❌
       │
       ├─► Timeout reached? ────────► Return timeout ⏱️
       │
       └─► Wait {interval}s ────────┘ (loop)
```

## Test Markers Usage

```bash
# Run only fast tests (< 30 seconds)
pytest -m fast

# Run only slow tests (minutes)
pytest -m slow

# Run polling-specific tests
pytest -m polling

# Run E2E tests only (skip partial/cancel)
pytest -m "e2e and not partial and not cancellation"

# Run everything except cancellation
pytest -m "not cancellation"
```

## Error Handling Flow

```
API Call
   │
   ├─► Success ─────────────────────────► Continue
   │
   ├─► Auth Error ──────► Print error ──► Fail test ❌
   │
   ├─► Network Error ───► Retry (3x) ───┬─► Success ──► Continue
   │                                     └─► Fail ─────► Fail test ❌
   │
   ├─► Timeout ─────────► Print logs ───► Fail test ❌
   │
   └─► Other Error ─────► Print trace ──► Fail test ❌
```

## Assertion Strategy

```
Every test includes assertions for:

┌─────────────────────────────────────┐
│ 1. Response exists (not None)       │
│ 2. Required fields present          │
│ 3. Status is expected value         │
│ 4. Progress is monotonic increasing │
│ 5. Data integrity (chunks ≤ total)  │
│ 6. No error messages (unless fail)  │
└─────────────────────────────────────┘
```

## Directory Structure

```
UCPv6/
├── tests/                          # Test suite root
│   ├── __init__.py                # Package marker
│   ├── test_config.py             # Configuration
│   ├── test_helpers.py            # Utilities
│   ├── test_process_v3_e2e.py     # Main tests
│   ├── requirements.txt           # Dependencies
│   ├── .env.template              # Config template
│   ├── .gitignore                 # Ignore patterns
│   ├── README.md                  # Full docs
│   ├── QUICKSTART.md              # Quick guide
│   └── SUMMARY.md                 # Overview
├── frontend/
│   └── app/
│       └── process-v3/
│           └── conversations.json # Test data
├── run_tests.sh                   # Bash runner
├── run_tests.py                   # Python runner
└── pytest.ini                     # Pytest config
```
