#!/bin/bash

# Load environment variables from railway.env
export $(grep -v '^#' railway.env | xargs)

# Start the backend with unbuffered output
python -u simple_backend.py
