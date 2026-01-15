#!/usr/bin/env bash
#
# Test Runner Script for Process V3 E2E Tests
# Usage: ./run_tests.sh [options]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Process V3 E2E Test Runner${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Python 3 found: $(python3 --version)${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo -e "${YELLOW}   Create a .env file with required credentials${NC}"
    echo ""
fi

# Check if test file exists
if [ ! -f frontend/app/process-v3/conversations.json ]; then
    echo -e "${RED}❌ Test file not found: frontend/app/process-v3/conversations.json${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Test file found: conversations.json${NC}"

# Install/upgrade dependencies
echo ""
echo -e "${BLUE}📦 Checking dependencies...${NC}"

if ! python3 -c "import pytest" &> /dev/null; then
    echo -e "${YELLOW}Installing pytest...${NC}"
    pip install pytest
fi

if ! python3 -c "import requests" &> /dev/null; then
    echo -e "${YELLOW}Installing requests...${NC}"
    pip install requests
fi

if ! python3 -c "import supabase" &> /dev/null; then
    echo -e "${YELLOW}Installing supabase...${NC}"
    pip install supabase
fi

if ! python3 -c "import dotenv" &> /dev/null; then
    echo -e "${YELLOW}Installing python-dotenv...${NC}"
    pip install python-dotenv
fi

echo -e "${GREEN}✅ All dependencies installed${NC}"

# Run the tests
echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Running Tests${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Parse command line arguments
PYTEST_ARGS="-v -s"

# Add any additional arguments passed to script
if [ $# -gt 0 ]; then
    PYTEST_ARGS="$PYTEST_ARGS $@"
fi

# Run pytest
cd tests
python3 -m pytest test_process_v3_e2e.py $PYTEST_ARGS

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}  ✅ All Tests Passed!${NC}"
    echo -e "${GREEN}================================================${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}================================================${NC}"
    echo -e "${RED}  ❌ Some Tests Failed${NC}"
    echo -e "${RED}================================================${NC}"
    exit 1
fi
