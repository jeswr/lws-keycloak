#!/bin/bash

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down all services..."
  
  # Kill Node.js services
  pkill -f "tsx watch" 2>/dev/null
  pkill -f "tsx src" 2>/dev/null
  
  # Stop Docker services
  echo "   Stopping Docker containers..."
  docker-compose down 2>/dev/null
  
  echo "✅ All services stopped"
  exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo "🚀 Starting all services in parallel..."
echo ""

# Start Docker services in background
echo "   Starting Keycloak + PostgreSQL + Redis..."
npm run docker:keycloak

# Wait for Keycloak to be ready
echo "   Waiting for Keycloak to be ready..."
sleep 15

# Start Node.js services in background
echo "   Starting CID resolver..."
npm run dev:cid > /tmp/lws-cid.log 2>&1 &
CID_PID=$!

echo "   Starting Storage server..."
npm run dev:storage > /tmp/lws-storage.log 2>&1 &
STORAGE_PID=$!

echo ""
echo "✅ All services started!"
echo ""
echo "📋 Logs:"
echo "   CID resolver: tail -f /tmp/lws-cid.log"
echo "   Storage server: tail -f /tmp/lws-storage.log"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for background processes
wait
