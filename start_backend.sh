#!/bin/bash

# Load environment variables from railway.env
export $(grep -v '^#' railway.env | xargs)

# Start the backend
python simple_backend.py
