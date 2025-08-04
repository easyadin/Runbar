#!/bin/bash

# Runbar Service Dependencies Setup Script

CONFIG_DIR="$HOME/.runbar"
SERVICES_FILE="$CONFIG_DIR/services.json"

echo "🔗 Runbar Service Dependencies Setup"
echo "====================================="

if [ ! -f "$SERVICES_FILE" ]; then
    echo "❌ No services found. Please add some services to Runbar first."
    exit 1
fi

# Read services from JSON file
SERVICES=$(cat "$SERVICES_FILE" | jq -r '.services[] | .name' 2>/dev/null)

if [ -z "$SERVICES" ]; then
    echo "❌ No services found in configuration."
    exit 1
fi

echo "📋 Available services:"
echo "$SERVICES" | nl

echo ""
echo "💡 Example dependencies:"
echo "  - API Gateway depends on: authentication-ms, registry-ms"
echo "  - Frontend depends on: API Gateway"
echo "  - Worker depends on: database, redis"
echo ""

read -p "Enter service name to configure dependencies: " SERVICE_NAME

# Check if service exists
if ! echo "$SERVICES" | grep -q "^$SERVICE_NAME$"; then
    echo "❌ Service '$SERVICE_NAME' not found."
    exit 1
fi

echo ""
echo "Select dependencies for '$SERVICE_NAME' (comma-separated, or 'none'):"
echo "Available: $SERVICES"
read -p "Dependencies: " DEPENDENCIES

if [ "$DEPENDENCIES" = "none" ] || [ -z "$DEPENDENCIES" ]; then
    echo "✅ No dependencies set for '$SERVICE_NAME'"
    exit 0
fi

# Validate dependencies
INVALID_DEPS=""
for dep in $(echo "$DEPENDENCIES" | tr ',' ' '); do
    dep=$(echo "$dep" | xargs) # trim whitespace
    if ! echo "$SERVICES" | grep -q "^$dep$"; then
        INVALID_DEPS="$INVALID_DEPS $dep"
    fi
done

if [ -n "$INVALID_DEPS" ]; then
    echo "❌ Invalid dependencies:$INVALID_DEPS"
    echo "Available services: $SERVICES"
    exit 1
fi

# Update the JSON file
echo "🔄 Updating service configuration..."

# Create a temporary file with the updated configuration
TEMP_FILE=$(mktemp)
cat "$SERVICES_FILE" | jq --arg name "$SERVICE_NAME" \
    --arg deps "$DEPENDENCIES" \
    '(.services[] | select(.name == $name)).dependencies = ($deps | split(",") | map(. | gsub("^\\s+|\\s+$"; "")))' \
    > "$TEMP_FILE"

# Backup original file
cp "$SERVICES_FILE" "$SERVICES_FILE.backup.$(date +%Y%m%d-%H%M%S)"

# Replace with updated file
mv "$TEMP_FILE" "$SERVICES_FILE"

echo "✅ Dependencies updated for '$SERVICE_NAME':"
echo "   Dependencies: $DEPENDENCIES"
echo "💡 Restart Runbar to apply changes" 