#!/bin/bash

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down all services..."
  
  # Kill Node.js services
  pkill -f "tsx watch" 2>/dev/null
  
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

# Wait a moment for Docker to start
sleep 2

# Start Node.js services with concurrently
concurrently --kill-others-on-fail --kill-others \
  -n "cid,storage" \
  -c "green,yellow" \
  "npm run dev:cid" \
  "npm run dev:storage"

# If concurrently exits, cleanup
cleanup
