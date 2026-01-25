#!/bin/sh
set -e

echo "Starting Pluma..."

# Start backend
echo "Starting backend on port 3001..."
cd /app/backend
node dist/index.js &
BACKEND_PID=$!

# Give backend time to start
sleep 5

# Start frontend
echo "Starting frontend on port 3000..."
cd /app/frontend
PORT=3000 node .output/server/index.mjs &
FRONTEND_PID=$!

echo "Pluma started successfully!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
