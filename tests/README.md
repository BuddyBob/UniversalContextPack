# Process V3 End-to-End Test Suite

Comprehensive automated test suite for the process-v3 workflow, testing the full pipeline from extraction to tree building to completion.

## Overview

This test suite automates end-to-end testing of the process-v3 feature, ensuring a smooth user experience through the complete workflow:

1. **Extraction** - Upload and extract text from conversations.json
2. **Chunking** - Split content into processable chunks
3. **Analysis** - Analyze each chunk with AI
4. **Tree Building** - Build memory tree from analysis
5. **Completion** - Verify final state and data integrity

## Test Coverage

### Main E2E Tests (`test_process_v3_e2e.py`)

#### TestProcessV3EndToEnd
- ✅ **test_01_verify_test_file_exists** - Validates test data file
- ✅ **test_02_upload_and_extract** - Tests file upload and extraction phase
- ✅ **test_03_check_credits_before_analysis** - Verifies credit availability
- ✅ **test_04_start_analysis_and_wait** - Full analysis + tree building workflow
- ✅ **test_05_verify_polling_reliability** - Tests polling consistency
- ✅ **test_06_verify_final_state** - Validates completed state

#### TestProcessV3PartialAnalysis
- ✅ **test_07_partial_analysis_with_limit** - Tests analyzing subset of chunks

#### TestProcessV3Cancellation
- ⏸️ **test_08_cancel_during_analysis** - Tests cancellation (optional/skipped)

## Setup

### 1. Environment Variables

Create a `.env` file in the project root with:

```bash
# API Configuration
API_BASE_URL=http://localhost:8000

# Test User Credentials
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=your-test-password

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Test Data

The test suite uses the conversations.json file located at:
```
frontend/app/process-v3/conversations.json
```

Make sure this file exists before running tests.

### 3. Install Dependencies

```bash
pip install pytest requests supabase python-dotenv
```

Or use the automated runner (see below).

## Running Tests

### Option 1: Bash Script (macOS/Linux)

```bash
./run_tests.sh
```

Run specific tests:
```bash
./run_tests.sh -k test_01
./run_tests.sh -k TestProcessV3EndToEnd
```

### Option 2: Python Runner (Cross-platform)

```bash
python run_tests.py
```

Run specific tests:
```bash
python run_tests.py -k test_01
```

### Option 3: Direct pytest

```bash
cd tests
pytest test_process_v3_e2e.py -v -s
```

## Test Output

The test suite provides detailed console output:

```
================================================
  Process V3 E2E Test Runner
================================================

✅ Python version: 3.11.0
✅ Test file found: conversations.json (10.52 MB)

================================================
  Running Tests
================================================

test_01_verify_test_file_exists PASSED
test_02_upload_and_extract PASSED
  📦 Test Pack Created: abc-123
  ✅ Source uploaded: xyz-789
  ⏳ Waiting for extraction and chunking...
  ✅ Extraction Complete!
     Total chunks created: 150

test_03_check_credits_before_analysis PASSED
test_04_start_analysis_and_wait PASSED
  ⏳ Waiting for analysis and tree building...
  [10.5s] Status: analyzing, Progress: 45%, Chunks: 67/150
  [20.3s] Status: building_tree, Progress: 95%, Chunks: 150/150
  ✅ Processing Complete!

test_05_verify_polling_reliability PASSED
test_06_verify_final_state PASSED

================================================
  ✅ All Tests Passed!
================================================
```

## Test Details

### Test Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Test 1: Verify Test File                                   │
│  ✓ Check conversations.json exists                          │
└────────────────────────────────────────┬────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Test 2: Upload & Extract                                    │
│  ✓ Create test pack                                          │
│  ✓ Upload conversations.json                                 │
│  ✓ Poll until status = ready_for_analysis                    │
│  ✓ Verify chunks created                                     │
└────────────────────────────────────────┬────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Test 3: Check Credits                                       │
│  ✓ Get user credit balance                                   │
│  ✓ Warn if insufficient credits                              │
└────────────────────────────────────────┬────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Test 4: Analysis & Tree Building                            │
│  ✓ Start analysis                                            │
│  ✓ Poll through: analyzing → building_tree → completed       │
│  ✓ Verify progress updates                                   │
│  ✓ Verify completion (status=completed, progress=100%)       │
└────────────────────────────────────────┬────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Test 5: Polling Reliability                                 │
│  ✓ Poll 5 times consecutively                                │
│  ✓ Verify consistent results                                 │
└────────────────────────────────────────┬────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Test 6: Final State Verification                            │
│  ✓ Verify all required fields present                        │
│  ✓ Verify data consistency                                   │
│  ✓ Verify processed_chunks <= total_chunks                   │
└─────────────────────────────────────────────────────────────┘
```

### Polling Strategy

The test suite uses intelligent polling:

- **Extraction Phase**: 2-second intervals, 5-minute timeout
- **Analysis Phase**: 2-second intervals, dynamic timeout based on chunk count
- **Tree Building**: 2-second intervals, 10-minute timeout
- **Status Checks**: 1-second intervals for quick verification

### Error Handling

Tests include comprehensive assertions:
- Status transitions (processing → ready → analyzing → building_tree → completed)
- Progress increases (never decreases)
- Data consistency (processed ≤ total chunks)
- Required fields present in responses
- Credit deduction validation

## Troubleshooting

### "Test file not found"
Ensure `frontend/app/process-v3/conversations.json` exists in your workspace.

### "Authentication failed"
- Check `.env` file has correct `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`
- Verify test user exists in Supabase
- Confirm Supabase credentials are correct

### "Failed to create pack"
- Ensure backend is running (`python simple_backend.py`)
- Check `API_BASE_URL` in `.env`
- Verify Supabase connection

### "Timeout waiting for extraction"
- Large files may take longer - adjust `EXTRACTION_TIMEOUT` in `test_config.py`
- Check backend logs for errors
- Verify R2 storage is accessible

### "Insufficient credits"
- Add credits to test user account
- Use test user with unlimited plan
- Test suite will use partial analysis if credits are limited

## Configuration

Modify `tests/test_config.py` to adjust:

```python
# Polling intervals
POLL_INTERVAL = 2  # seconds between polls
MAX_POLL_ATTEMPTS = 300  # max attempts before timeout

# Timeouts
EXTRACTION_TIMEOUT = 300  # 5 minutes
ANALYSIS_TIMEOUT_PER_CHUNK = 30  # 30 seconds per chunk
TREE_BUILD_TIMEOUT = 600  # 10 minutes
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run Process V3 E2E Tests
  run: |
    python run_tests.py
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

## Test Data

The test uses a real conversations.json file to ensure realistic testing. For smaller/faster tests, consider:

1. Creating a smaller test file with fewer conversations
2. Using `max_chunks` parameter to limit processing
3. Adjusting timeouts for faster feedback

## Contributing

When adding new tests:

1. Follow existing test naming convention (`test_##_description`)
2. Add detailed print statements for debugging
3. Use helper classes (`TestAPIClient`, `PollingHelper`, `AssertionHelper`)
4. Update this README with new test descriptions
5. Ensure tests clean up resources (packs, sources)

## Support

For issues or questions:
- Check backend logs: `simple_backend.py` console output
- Review Supabase logs for database errors
- Examine R2 storage for file upload issues
- Test individual components with pytest markers:
  ```bash
  pytest -k test_02 -v -s  # Run only test 02
  ```

---

**Last Updated**: January 2026  
**Test Suite Version**: 1.0  
**Compatible With**: Process V3
