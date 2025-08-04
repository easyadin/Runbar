#!/bin/bash

# Runbar Installation Script
echo "🚀 Installing Runbar..."

# Check if DMG exists
if [ ! -f "dist/Runbar-1.0.0-arm64.dmg" ]; then
    echo "❌ DMG file not found. Please run 'npm run dist:mac' first."
    exit 1
fi

# Mount the DMG
echo "📦 Mounting Runbar DMG..."
hdiutil attach "dist/Runbar-1.0-arm64.dmg"

# Copy to Applications
echo "📱 Installing Runbar to Applications..."
cp -R "/Volumes/Runbar/Runbar.app" "/Applications/"

# Unmount the DMG
echo "🔧 Cleaning up..."
hdiutil detach "/Volumes/Runbar"

echo "✅ Runbar installed successfully!"
echo "🎉 You can now find Runbar in your Applications folder"
echo "💡 Runbar will appear in your menu bar when you launch it" 