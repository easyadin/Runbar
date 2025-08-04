#!/bin/bash

# Runbar Configuration Backup/Restore Script

CONFIG_DIR="$HOME/.runbar"
BACKUP_DIR="./backups"

case "$1" in
    "backup")
        echo "📦 Creating backup of Runbar configuration..."
        
        # Create backup directory
        mkdir -p "$BACKUP_DIR"
        
        # Backup config files
        if [ -d "$CONFIG_DIR" ]; then
            cp -R "$CONFIG_DIR" "$BACKUP_DIR/runbar-config-$(date +%Y%m%d-%H%M%S)"
            echo "✅ Configuration backed up to $BACKUP_DIR"
        else
            echo "❌ No configuration found at $CONFIG_DIR"
        fi
        ;;
        
    "restore")
        if [ -z "$2" ]; then
            echo "❌ Please specify backup directory: ./backup-config.sh restore <backup-dir>"
            exit 1
        fi
        
        echo "🔄 Restoring Runbar configuration from $2..."
        
        if [ -d "$2" ]; then
            # Stop Runbar if running
            pkill -f "Runbar" || true
            
            # Restore config
            cp -R "$2"/* "$CONFIG_DIR/"
            echo "✅ Configuration restored from $2"
            echo "💡 Restart Runbar to apply changes"
        else
            echo "❌ Backup directory $2 not found"
        fi
        ;;
        
    "list")
        echo "📋 Available backups:"
        if [ -d "$BACKUP_DIR" ]; then
            ls -la "$BACKUP_DIR"
        else
            echo "No backups found"
        fi
        ;;
        
    *)
        echo "Usage: $0 {backup|restore <backup-dir>|list}"
        echo ""
        echo "Commands:"
        echo "  backup    - Create a backup of current configuration"
        echo "  restore   - Restore configuration from backup"
        echo "  list      - List available backups"
        exit 1
        ;;
esac 