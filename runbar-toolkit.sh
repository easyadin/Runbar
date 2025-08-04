#!/bin/bash

# Runbar Development Toolkit
# A comprehensive tool for managing Runbar development environment

echo "🛠️  Runbar Development Toolkit"
echo "=============================="
echo ""

# Function to show menu
show_menu() {
    echo "📋 Available Commands:"
    echo ""
    echo "🚀 Development:"
    echo "  1) Start development mode"
    echo "  2) Build and run once"
    echo "  3) Build for distribution"
    echo ""
    echo "📦 Templates & Setup:"
    echo "  4) Apply service template"
    echo "  5) Setup service dependencies"
    echo "  6) Install Runbar app"
    echo ""
    echo "🔧 Configuration:"
    echo "  7) Backup configuration"
    echo "  8) Restore configuration"
    echo "  9) List backups"
    echo ""
    echo "📊 Status & Info:"
    echo "  10) Show app status"
    echo "  11) Show service info"
    echo "  12) Check system requirements"
    echo ""
    echo "🧹 Maintenance:"
    echo "  13) Clean build files"
    echo "  14) Update dependencies"
    echo "  15) Reset configuration"
    echo ""
    echo "❌ Exit"
    echo ""
}

# Function to check if Runbar is running
check_runbar_status() {
    if pgrep -f "Runbar" > /dev/null; then
        echo "✅ Runbar is running"
        return 0
    else
        echo "❌ Runbar is not running"
        return 1
    fi
}

# Function to show service info
show_service_info() {
    CONFIG_DIR="$HOME/.runbar"
    SERVICES_FILE="$CONFIG_DIR/services.json"
    
    if [ ! -f "$SERVICES_FILE" ]; then
        echo "❌ No services configured"
        return
    fi
    
    echo "📊 Service Information:"
    echo "======================="
    
    # Count services
    SERVICE_COUNT=$(cat "$SERVICES_FILE" | jq '.services | length' 2>/dev/null || echo "0")
    echo "Total services: $SERVICE_COUNT"
    
    # Show service names
    if [ "$SERVICE_COUNT" -gt 0 ]; then
        echo ""
        echo "Services:"
        cat "$SERVICES_FILE" | jq -r '.services[] | "  - \(.name) (\(.projectType // "unknown"))"' 2>/dev/null || echo "  Error reading services"
    fi
    
    # Check groups
    GROUPS_FILE="$CONFIG_DIR/groups.json"
    if [ -f "$GROUPS_FILE" ]; then
        GROUP_COUNT=$(cat "$GROUPS_FILE" | jq '.groups | length' 2>/dev/null || echo "0")
        echo ""
        echo "Groups: $GROUP_COUNT"
        if [ "$GROUP_COUNT" -gt 0 ]; then
            cat "$GROUPS_FILE" | jq -r '.groups[] | "  - \(.name)"' 2>/dev/null || echo "  Error reading groups"
        fi
    fi
}

# Function to check system requirements
check_system_requirements() {
    echo "🔍 System Requirements Check:"
    echo "============================="
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        echo "✅ Node.js: $NODE_VERSION"
    else
        echo "❌ Node.js: Not installed"
    fi
    
    # Check npm
    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        echo "✅ npm: $NPM_VERSION"
    else
        echo "❌ npm: Not installed"
    fi
    
    # Check jq
    if command -v jq >/dev/null 2>&1; then
        echo "✅ jq: Available"
    else
        echo "❌ jq: Not installed (needed for templates)"
    fi
    
    # Check Docker (optional)
    if command -v docker >/dev/null 2>&1; then
        echo "✅ Docker: Available"
    else
        echo "⚠️  Docker: Not installed (needed for some templates)"
    fi
    
    # Check available disk space
    DISK_SPACE=$(df -h . | awk 'NR==2 {print $4}')
    echo "💾 Available disk space: $DISK_SPACE"
}

# Function to clean build files
clean_build_files() {
    echo "🧹 Cleaning build files..."
    
    # Remove dist directory
    if [ -d "dist" ]; then
        rm -rf dist
        echo "✅ Removed dist directory"
    fi
    
    # Remove node_modules (optional)
    read -p "Remove node_modules? (y/N): " REMOVE_NODE_MODULES
    if [[ "$REMOVE_NODE_MODULES" =~ ^[Yy]$ ]]; then
        if [ -d "node_modules" ]; then
            rm -rf node_modules
            echo "✅ Removed node_modules"
        fi
    fi
    
    echo "🧹 Cleanup complete"
}

# Function to update dependencies
update_dependencies() {
    echo "📦 Updating dependencies..."
    
    if [ -f "package.json" ]; then
        npm update
        echo "✅ Dependencies updated"
    else
        echo "❌ package.json not found"
    fi
}

# Function to reset configuration
reset_configuration() {
    echo "⚠️  WARNING: This will delete all Runbar configuration!"
    read -p "Are you sure? (y/N): " CONFIRM
    
    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
        CONFIG_DIR="$HOME/.runbar"
        if [ -d "$CONFIG_DIR" ]; then
            rm -rf "$CONFIG_DIR"
            echo "✅ Configuration reset"
        else
            echo "ℹ️  No configuration to reset"
        fi
    else
        echo "❌ Reset cancelled"
    fi
}

# Main menu loop
while true; do
    show_menu
    read -p "Select option (1-15): " CHOICE
    
    case $CHOICE in
        1)
            echo "🚀 Starting development mode..."
            ./dev-quick.sh
            ;;
        2)
            echo "📦 Building and running once..."
            npm run dev:simple
            ;;
        3)
            echo "📦 Building for distribution..."
            npm run dist:mac
            ;;
        4)
            echo "🎯 Applying service template..."
            ./apply-template.sh
            ;;
        5)
            echo "🔗 Setting up service dependencies..."
            ./setup-dependencies.sh
            ;;
        6)
            echo "📱 Installing Runbar app..."
            ./install.sh
            ;;
        7)
            echo "💾 Creating backup..."
            ./backup-config.sh backup
            ;;
        8)
            echo "📋 Available backups:"
            ./backup-config.sh list
            read -p "Enter backup directory to restore: " BACKUP_DIR
            ./backup-config.sh restore "$BACKUP_DIR"
            ;;
        9)
            echo "📋 Listing backups..."
            ./backup-config.sh list
            ;;
        10)
            echo "📊 Checking Runbar status..."
            check_runbar_status
            ;;
        11)
            show_service_info
            ;;
        12)
            check_system_requirements
            ;;
        13)
            clean_build_files
            ;;
        14)
            update_dependencies
            ;;
        15)
            reset_configuration
            ;;
        *)
            echo "❌ Invalid option. Please select 1-15."
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
done 