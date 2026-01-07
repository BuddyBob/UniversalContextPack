# Pre-Flight Checklist - Process V3 E2E Tests

Use this checklist before running tests to ensure everything is configured correctly.

## ✅ Environment Setup

### 1. Python Environment
- [ ] Python 3.8+ installed (`python3 --version`)
- [ ] pip is up to date (`pip install --upgrade pip`)
- [ ] Virtual environment activated (recommended)

### 2. Dependencies
- [ ] pytest installed (`pip list | grep pytest`)
- [ ] requests installed (`pip list | grep requests`)
- [ ] supabase installed (`pip list | grep supabase`)
- [ ] python-dotenv installed (`pip list | grep python-dotenv`)

**Quick Install:**
```bash
pip install -r tests/requirements.txt
```

## ✅ Configuration

### 3. Environment Variables (.env)
- [ ] `.env` file exists in project root
- [ ] `API_BASE_URL` is set (e.g., `http://localhost:8000`)
- [ ] `TEST_USER_EMAIL` is set
- [ ] `TEST_USER_PASSWORD` is set
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (optional but recommended)

**Create from template:**
```bash
cp tests/.env.template .env
# Edit .env with your values
```

## ✅ Test User Setup

### 4. Supabase Test User
- [ ] Test user exists in Supabase Auth
- [ ] Test user has verified email
- [ ] Test user has entry in `user_profiles` table
- [ ] Test user has credits > 0 OR unlimited plan
- [ ] Test user credentials match `.env` file

**Check credits:**
```sql
SELECT id, email, credits_balance, payment_plan 
FROM user_profiles 
WHERE email = 'your-test-email@example.com';
```

## ✅ Test Data

### 5. Conversations.json File
- [ ] File exists at `frontend/app/process-v3/conversations.json`
- [ ] File is valid JSON
- [ ] File size is reasonable (< 100MB recommended)
- [ ] File is readable by test suite

**Verify:**
```bash
ls -lh frontend/app/process-v3/conversations.json
python -m json.tool frontend/app/process-v3/conversations.json > /dev/null && echo "✅ Valid JSON"
```

## ✅ Backend & Services

### 6. Backend Server
- [ ] Backend is running (`python simple_backend.py`)
- [ ] Backend is accessible (check `API_BASE_URL`)
- [ ] Backend shows no startup errors
- [ ] Backend has database connection

**Test backend:**
```bash
curl http://localhost:8000/health  # If you have a health endpoint
```

### 7. Supabase Connection
- [ ] Supabase project is active
- [ ] Database is accessible
- [ ] RLS policies allow test user access
- [ ] RPC functions exist (`get_source_status_v2`, etc.)

**Test connection:**
```python
from supabase import create_client
import os
supabase = create_client(os.getenv("NEXT_PUBLIC_SUPABASE_URL"), os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
print("✅ Connected" if supabase else "❌ Failed")
```

### 8. Storage (R2/S3)
- [ ] R2/S3 credentials are configured in backend
- [ ] Storage bucket exists
- [ ] Backend can write to storage
- [ ] Backend can read from storage

## ✅ Pre-Run Verification

### 9. Quick Smoke Tests
Run these commands to verify setup:

```bash
# 1. Check test file structure
cd /Users/thavasantonio/Documents/UCPv6
ls -la tests/

# 2. Verify Python can import test modules
python -c "from tests import test_config; print('✅ Config OK')"
python -c "from tests import test_helpers; print('✅ Helpers OK')"

# 3. Check pytest discovery
cd tests
pytest --collect-only test_process_v3_e2e.py

# 4. Run fast tests only (< 1 minute)
pytest -m fast -v test_process_v3_e2e.py
```

## ✅ Final Checks

### 10. Before Full Test Run
- [ ] Backend server is running and responsive
- [ ] No other tests are currently running
- [ ] Test user has sufficient credits (or unlimited plan)
- [ ] Disk space is adequate for test artifacts
- [ ] Network connection is stable

### 11. Expected Resources
- **Time**: 5-15 minutes for full suite
- **Network**: Continuous internet for API calls
- **Storage**: ~100MB for test data
- **Credits**: Number of chunks in test file (or unlimited)

## ✅ Run Tests

Once all checks pass, run:

```bash
# Option 1: Python runner (recommended)
python run_tests.py

# Option 2: Bash runner
./run_tests.sh

# Option 3: Direct pytest
cd tests && pytest test_process_v3_e2e.py -v -s

# Option 4: Run specific test
pytest -k test_02 -v -s
```

## ✅ Success Criteria

After running, you should see:
- [ ] All 6 main tests PASSED
- [ ] No Python exceptions
- [ ] No connection errors
- [ ] Backend shows no errors in logs
- [ ] Test pack created successfully
- [ ] Source processed to completion
- [ ] Final status is "completed"
- [ ] Progress reached 100%

## 🚨 Troubleshooting

If any checkbox fails, refer to:
- `tests/README.md` - Full documentation
- `tests/QUICKSTART.md` - Quick setup guide
- `tests/ARCHITECTURE.md` - System architecture
- Backend logs - `simple_backend.py` console

## 📋 Quick Troubleshooting

### "Module not found"
```bash
pip install -r tests/requirements.txt
```

### "Authentication failed"
- Verify TEST_USER_EMAIL and TEST_USER_PASSWORD in .env
- Check user exists in Supabase
- Try signing in manually to Supabase

### "Connection refused"
- Start backend: `python simple_backend.py`
- Check API_BASE_URL in .env
- Verify port is not blocked

### "Test file not found"
- Check file exists: `ls frontend/app/process-v3/conversations.json`
- Verify working directory is project root

### "Insufficient credits"
- Check user credits in Supabase
- Add credits or switch to unlimited plan
- Use partial analysis: `pytest -k test_07`

---

**Ready to run?** If all checkboxes are ✅, proceed with:
```bash
python run_tests.py
```

**Good luck! 🚀**
