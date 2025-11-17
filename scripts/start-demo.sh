#!/bin/bash

# Start LWS services and demo app, then open browser

echo "🚀 Starting LWS services and demo..."
echo ""

# Start all services except demo in background
npm run dev:all:parallel &
SERVICES_PID=$!

# Wait for services to start
echo "⏳ Waiting for services to start (20 seconds)..."
sleep 20

# Start demo app in background
echo "🎨 Starting demo app..."
npm run dev:demo > /tmp/lws-demo.log 2>&1 &
DEMO_PID=$!

# Give demo app time to start
sleep 3

echo ""
echo "================================"
echo "✨ Demo Ready!"
echo "================================"
echo ""
echo "🌐 Opening demo at http://localhost:3002"
echo ""

# Open browser based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open http://localhost:3002
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open http://localhost:3002 2>/dev/null || echo "Please open http://localhost:3002 in your browser"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    start http://localhost:3002
else
    echo "Please open http://localhost:3002 in your browser"
fi

echo ""
echo "📋 Demo app log: tail -f /tmp/lws-demo.log"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for user to stop
wait
