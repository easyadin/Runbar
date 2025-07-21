#!/bin/bash

echo "🚀 Starting Runbar development mode..."
echo "📝 This will watch for changes and restart the app automatically"
echo "🛑 Press Ctrl+C to stop"

# Function to build and start
build_and_start() {
    echo "🔨 Building TypeScript..."
    npm run build
    if [ $? -eq 0 ]; then
        echo "✅ Build successful! Starting Electron..."
        electron . &
        ELECTRON_PID=$!
        echo "🎯 Electron started with PID: $ELECTRON_PID"
    else
        echo "❌ Build failed!"
        return 1
    fi
}

# Function to stop electron
stop_electron() {
    if [ ! -z "$ELECTRON_PID" ]; then
        echo "🛑 Stopping Electron (PID: $ELECTRON_PID)..."
        kill $ELECTRON_PID 2>/dev/null
        wait $ELECTRON_PID 2>/dev/null
    fi
}

# Function to restart
restart() {
    echo "🔄 Restarting..."
    stop_electron
    sleep 1
    build_and_start
}

# Initial build and start
build_and_start

# Watch for changes
echo "👀 Watching for changes in src/ directory..."
fswatch -o src/ | while read f; do
    echo "📝 Change detected, restarting..."
    restart
done

# Cleanup on exit
trap 'echo "👋 Shutting down..."; stop_electron; exit 0' INT TERM 