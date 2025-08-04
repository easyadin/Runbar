#!/bin/bash

# Runbar Template Application Script

TEMPLATES_FILE="templates.json"
CONFIG_DIR="$HOME/.runbar"
SERVICES_FILE="$CONFIG_DIR/services.json"

echo "🎯 Runbar Service Templates"
echo "============================"

if [ ! -f "$TEMPLATES_FILE" ]; then
    echo "❌ Templates file not found: $TEMPLATES_FILE"
    exit 1
fi

# Show available templates
echo "📋 Available templates:"
echo ""

# Use jq to parse and display templates
TEMPLATES=$(cat "$TEMPLATES_FILE" | jq -r '.templates | to_entries[] | "\(.key): \(.value.name) - \(.value.description)"')

if [ -z "$TEMPLATES" ]; then
    echo "❌ No templates found in $TEMPLATES_FILE"
    exit 1
fi

echo "$TEMPLATES" | nl
echo ""

read -p "Enter template number (1-6) or template key: " TEMPLATE_INPUT

# Convert number to template key if needed
case $TEMPLATE_INPUT in
    1) TEMPLATE_KEY="fullstack-node" ;;
    2) TEMPLATE_KEY="microservices" ;;
    3) TEMPLATE_KEY="react-native" ;;
    4) TEMPLATE_KEY="python-django" ;;
    5) TEMPLATE_KEY="vue-nuxt" ;;
    6) TEMPLATE_KEY="nextjs" ;;
    *) TEMPLATE_KEY="$TEMPLATE_INPUT" ;;
esac

# Validate template exists
if ! cat "$TEMPLATES_FILE" | jq -e ".templates.$TEMPLATE_KEY" > /dev/null 2>&1; then
    echo "❌ Template '$TEMPLATE_KEY' not found."
    exit 1
fi

# Get template info
TEMPLATE_NAME=$(cat "$TEMPLATES_FILE" | jq -r ".templates.$TEMPLATE_KEY.name")
TEMPLATE_DESC=$(cat "$TEMPLATES_FILE" | jq -r ".templates.$TEMPLATE_KEY.description")

echo ""
echo "📦 Template: $TEMPLATE_NAME"
echo "📝 Description: $TEMPLATE_DESC"
echo ""

# Show services that will be added
echo "🔧 Services to be added:"
cat "$TEMPLATES_FILE" | jq -r ".templates.$TEMPLATE_KEY.services[] | \"  - \(.name) (\(.projectType))\""
echo ""

read -p "Apply this template? (y/N): " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "❌ Template application cancelled."
    exit 0
fi

# Backup existing services
if [ -f "$SERVICES_FILE" ]; then
    cp "$SERVICES_FILE" "$SERVICES_FILE.backup.$(date +%Y%m%d-%H%M%S)"
    echo "💾 Backed up existing services"
fi

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Get existing services (if any)
EXISTING_SERVICES="[]"
if [ -f "$SERVICES_FILE" ]; then
    EXISTING_SERVICES=$(cat "$SERVICES_FILE" | jq -r '.services // []')
fi

# Get template services
TEMPLATE_SERVICES=$(cat "$TEMPLATES_FILE" | jq -r ".templates.$TEMPLATE_KEY.services")

# Merge services
MERGED_SERVICES=$(echo "$EXISTING_SERVICES" | jq -s '.[0] + .[1]' <(echo "$TEMPLATE_SERVICES"))

# Create new services file
cat > "$SERVICES_FILE" << EOF
{
  "version": "1.0",
  "services": $MERGED_SERVICES
}
EOF

echo "✅ Template '$TEMPLATE_NAME' applied successfully!"
echo "📊 Added $(echo "$TEMPLATE_SERVICES" | jq length) new services"
echo "💡 Restart Runbar to see the new services"
echo ""
echo "🔧 Next steps:"
echo "  1. Update service paths in ~/.runbar/services.json"
echo "  2. Customize commands if needed"
echo "  3. Restart Runbar" 