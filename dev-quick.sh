#!/bin/bash

# Quick Development Script for Runbar
echo "🚀 Starting Runbar in development mode..."

# Kill any existing Runbar processes
echo "🔄 Stopping any existing Runbar instances..."
pkill -f "Runbar" || true

# Build and run
echo "📦 Building and starting Runbar..."
npm run dev:simple

echo "✅ Runbar development session ended" 