#!/bin/bash

# LWS Demo Setup Script
# This script sets up and starts the LWS demo application

set -e

echo "🚀 LWS Demo Application Setup"
echo "================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check if services are already running
if docker-compose ps | grep -q "Up"; then
    echo "⚠️  Some services are already running."
    read -p "Do you want to restart them? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping existing services..."
        docker-compose down
    fi
fi

echo "📦 Starting services with Docker Compose..."
docker-compose up -d postgres redis keycloak cid-resolver storage-server demo-app

echo ""
echo "⏳ Waiting for Keycloak to be ready (this may take 30-60 seconds)..."

# Wait for Keycloak to be healthy
COUNTER=0
MAX_TRIES=60

until docker-compose exec -T keycloak curl -sf http://localhost:8080/health/ready > /dev/null 2>&1; do
    COUNTER=$((COUNTER+1))
    if [ $COUNTER -gt $MAX_TRIES ]; then
        echo "❌ Error: Keycloak failed to start within the expected time"
        echo "   Check logs with: docker-compose logs keycloak"
        exit 1
    fi
    echo -n "."
    sleep 2
done

echo ""
echo "✅ Keycloak is ready"
echo ""

# Check if demo-app dependencies are installed
if [ ! -d "demo-app/node_modules" ]; then
    echo "📦 Installing demo app dependencies..."
    cd demo-app && npm install && cd ..
fi

echo "⚙️  Setting up Keycloak configuration..."
npm run keycloak:setup

echo ""
echo "================================"
echo "✨ Setup Complete!"
echo "================================"
echo ""
echo "🌐 Demo Application: http://localhost:3002"
echo "🔐 Keycloak Admin:   http://localhost:8080 (admin/admin)"
echo "💾 Storage Server:   http://localhost:3001"
echo "🔍 CID Resolver:     http://localhost:3000"
echo ""
echo "📖 For more information, see DEMO.md"
echo ""
echo "Useful commands:"
echo "  docker-compose logs -f         # View all logs"
echo "  docker-compose logs -f demo-app # View demo app logs"
echo "  docker-compose down            # Stop all services"
echo "  docker-compose restart keycloak # Restart Keycloak"
echo ""
