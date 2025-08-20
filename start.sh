#!/bin/bash
echo "Starting application..."
echo "PORT is: $PORT"
echo "Using port: ${PORT:-8000}"
uvicorn simple_backend:app --host 0.0.0.0 --port ${PORT:-8000}
