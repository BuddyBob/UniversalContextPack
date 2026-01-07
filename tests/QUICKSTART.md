# Quick Start Guide - Process V3 E2E Tests

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
cd /Users/thavasantonio/Documents/UCPv6
pip install -r tests/requirements.txt
```

### 2. Configure Environment
```bash
# Copy template
cp tests/.env.template .env

# Edit .env with your credentials:
# - TEST_USER_EMAIL (your test user email)
# - TEST_USER_PASSWORD (your test user password)
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Start Backend
```bash
# In one terminal
python simple_backend.py
```

### 4. Run Tests
```bash
# In another terminal
python run_tests.py
```

## 📋 What Gets Tested

✅ **Full E2E Workflow**
- Upload conversations.json
- Extract text from file
- Chunk into processable pieces
- Analyze each chunk with AI
- Build memory tree
- Verify completion

✅ **Polling System**
- Status transitions
- Progress updates
- Consistency checks

✅ **Edge Cases**
- Partial analysis (limited chunks)
- Credit management
- Cancellation (optional)

## ⚡ Quick Commands

```bash
# Run all tests
python run_tests.py

# Run specific test
python run_tests.py -k test_01

# Run only E2E tests (skip partial/cancel)
python run_tests.py -k TestProcessV3EndToEnd

# Verbose output with print statements
cd tests && pytest test_process_v3_e2e.py -v -s

# Generate HTML report
cd tests && pytest test_process_v3_e2e.py --html=report.html --self-contained-html
```

## 📊 Expected Results

**Test Duration**: 5-15 minutes (depends on file size)

**All tests should PASS** ✅

Example output:
```
test_01_verify_test_file_exists PASSED (0.01s)
test_02_upload_and_extract PASSED (120.5s)
test_03_check_credits_before_analysis PASSED (0.3s)
test_04_start_analysis_and_wait PASSED (450.2s)
test_05_verify_polling_reliability PASSED (2.5s)
test_06_verify_final_state PASSED (0.3s)

6 passed in 573.8s (9m 33s)
```

## 🐛 Common Issues

**"Authentication failed"**
→ Check TEST_USER_EMAIL and TEST_USER_PASSWORD in .env

**"Test file not found"**
→ Ensure frontend/app/process-v3/conversations.json exists

**"Connection refused"**
→ Start backend: `python simple_backend.py`

**"Timeout"**
→ Large files take time. Increase timeouts in test_config.py

## 📁 Test Files

```
tests/
├── __init__.py                 # Package marker
├── test_config.py              # Configuration & constants
├── test_helpers.py             # API client & utilities
├── test_process_v3_e2e.py      # Main test suite
├── requirements.txt            # Dependencies
├── .env.template               # Environment template
└── README.md                   # Full documentation
```

## 💡 Tips

- **First run**: May take 10-15 minutes for large files
- **Subsequent runs**: Create smaller test files for faster iteration
- **CI/CD**: Tests work in automated pipelines
- **Debugging**: Check backend logs for detailed error info

## 🎯 Next Steps

1. ✅ Run tests once manually
2. ✅ Verify all pass
3. ✅ Add to CI/CD pipeline
4. ✅ Run before deploying changes
5. ✅ Create smaller test files for faster dev cycles

---

Need help? Check the full [README.md](README.md) for detailed documentation.
