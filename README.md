# Runbar

Runbar helps developers manage multiple local services from a single place. It's designed to simplify your development workflow by providing one-click control over starting and stopping services spread across your system.

---

## 🧭 Purpose

Avoid manually running `npm start`, `pnpm dev`, or opening terminal tabs. Runbar centralizes service management in a lightweight tray app.

---

## 🚀 Quick Start

1. **Install and Run**:
   ```bash
   git clone https://github.com/your-username/runbar.git
   cd runbar
   npm install
   npm run dev
   ```

2. **Add Your First Service**:
   - Right-click the tray icon
   - Click "Add Folder to Scan..."
   - Select a folder with your projects
   - Choose which services to add

3. **Start Managing**:
   - Click on groups to start/stop all services
   - Click on individual services for control
   - View logs with "View Group Logs"

---

## ✅ Core Features

### 1. Tray Menu UI
- Resides in macOS system tray
- **Tray icon shows overall system status:**
  - 🟢 Green: All expected services running
  - 🟡 Yellow: Some services starting up
  - 🔴 Red: One or more services stopped/crashed
  - ⚪ Gray: All services stopped
- Lists services with live status icons:
  - 🟢 running
  - 🔴 stopped
  - 🟡 starting
- **Shows project type indicators** (Node.js, Ruby, Go, etc.)
- Click to start/stop services
- Group support for batch actions

### 2. Enhanced Service Discovery
- **One-click folder scanning** with intelligent project detection
- **15+ Project Types Supported:**
  - **Web Frameworks**: Next.js, Nuxt.js, Vue.js, Angular, Svelte, Gatsby
  - **Mobile**: React Native, Flutter
  - **Backend**: Node.js, Python, Ruby, Go, Rust, Java, PHP, .NET
  - **Infrastructure**: Docker, Shell scripts
- **Smart Command Detection:**
  - Auto-detects framework-specific start commands
  - Reads package.json scripts and dependencies
  - Provides sensible defaults for each project type
  - Manual override available for custom commands
- **Intelligent Naming:**
  - Extracts project names from config files
  - Fallback to directory names
  - User customization during import
- **Smart script detection** with manual override:
  - Auto-detects common scripts (`dev`, `start`, `rails server`, etc.)
  - Manual entry for custom commands when auto-detection fails
  - Supports all package managers and custom setups
- **Smart service naming** with user control:
  - Uses project name from config files when available
  - Falls back to folder name if no config name
  - Users can always customize names during import
- Presents services with checkboxes:
  - Import selected or all

### 3. Manual Add
- Fill form: Name, Path, Command
- Immediately added to tray menu

### 4. Grouping
- Create named groups (e.g. "Local Dev", "Background Jobs")
- Add any service to any group
- **Unlimited groups per service** (flat structure, no nesting)
- **Group membership shown** in service list for clarity
- Click group name to start/stop all in group

### 5. Real-time Monitoring & Logs
- **Live Service Status**: Real-time status indicators with color coding
- **Live Log Streaming**: View logs in beautiful terminal-style windows
- **Port Conflict Detection**: Automatic detection and resolution of port conflicts
- **Auto-restart on Crash**: Configurable auto-restart for failed services
- **Status Polling**: Configurable polling intervals for service health checks

### 6. Advanced Group Management
- **Bulk Operations**: Start All, Stop All, Restart All for groups
- **Group Management**: Rename, duplicate, and delete groups
- **Service Management**: Add/remove services from groups
- **Group Templates**: Quick group creation from templates (coming soon)

### 7. Modern Settings & Configuration
- **Beautiful Settings UI**: Modern dark theme with gradient accents
- **Theme Customization**: Dark, Light, and Auto themes
- **Discovery Configuration**: Customize project detection markers
- **Performance Settings**: Configure log limits and polling intervals
- **Data Management**: Export/import configurations, clear data

### 8. Persistent Storage
- Config stored in `~/.runbar/`
  - `services.json`
  - `groups.json`
  - `settings.json`
- **Versioned config format** for future compatibility
- **Data migration** for seamless updates
- **Backup and restore** functionality
```json
{
  "version": "1.0",
  "services": [
    {
      "name": "API Gateway",
      "path": "/Users/me/code/api-server",
      "command": "npm run dev",
      "autoStart": true
    },
    {
      "name": "Test Database",
      "path": "/Users/me/code/test-db",
      "command": "docker-compose up",
      "autoStart": false
    }
  ],
  "groups": [
    {
      "name": "Local Dev",
      "services": ["API Gateway", "React App"],
      "autoStart": true
    },
    {
      "name": "Testing",
      "services": ["Test Database", "Test API"],
      "autoStart": false
    }
  ],
  "settings": {
    "globalAutoStart": false,
    "discoveryMarkers": ["package.json", "Gemfile", "go.mod"]
  }
}
```

### 6. Process Control
- Uses `child_process.spawn` to run commands
- **Status polling** every 2-3 seconds with real-time event detection
- **Graceful shutdown**: SIGINT → SIGTERM (5s) → SIGKILL
- **Log capture**: stdout/stderr with on-demand log viewing
- **Manual restart only** (no auto-restart on crash)
- **Progressive error feedback**: Status indicators → Toast notifications → Error dialogs

### 7. Granular Auto-Start Control
- **Per-service auto-start**: Individual service settings
- **Per-group auto-start**: Group-level control
- **Global default**: App-wide auto-start preference
- **Override hierarchy**: Service > Group > Global settings
- Shows "Last Run: [Group]" for manual sessions

### 8. App Startup & Initialization
- **Fast startup**: Tray icon appears immediately
- **Background validation**: Paths, dependencies, port conflicts
- **Non-blocking**: App works even if some services have issues
- **Status indicators**: Show warnings for invalid services
- **Auto-start enabled services** after validation completes

### 9. Settings Panel
- **Separate modal window** with tabbed interface
- **General**: Auto-start options, tray behavior
- **Discovery**: Configure file type markers, scan folders
- **Services**: Edit service list, import/export config
- **Groups**: Edit group management
- Save/Cancel functionality with persistent settings

### 10. Accessibility Support
- **VoiceOver support** with proper labels and status announcements
- **Keyboard navigation** in settings modal and tray menu
- **High contrast support** for macOS accessibility settings
- **Screen reader friendly** service names and status indicators

### 11. Performance & Resource Management
- **Lightweight tray app**: <50MB memory, <1% CPU when idle
- **Log storage limits**: 100 lines per service (configurable)
- **Efficient polling**: Status checks every 2-3 seconds
- **Resource cleanup**: Proper process termination and memory management
- **Background optimization**: Lazy loading, non-blocking operations

### 12. Security & Permissions
- **Standard macOS security**: Runs as current user, no elevated privileges
- **Process isolation**: Each service runs in separate child process
- **Directory-based execution**: Services run from their own directories
- **No special permissions**: Works with standard macOS security model

### 13. Testing & Quality Assurance
- **Unit tests** for critical functions (service discovery, process management)
- **Manual testing** for UI workflows and user experience
- **Beta testing** with developer community for real-world validation
- **Balanced approach**: Reliable core with user-focused validation

### 14. Documentation & User Support
- **Built-in help**: Tooltips, context menus, help modal
- **External documentation**: GitHub README, website, video tutorials
- **Community support**: GitHub issues, Discord server for real-time help
- **Progressive disclosure**: Help available when needed, self-service approach

### 15. Distribution & Deployment
- **GitHub releases**: Downloadable `.dmg` files for easy distribution
- **Website**: Direct download page with documentation and features
- **Conventional auto-update**: App checks GitHub for new versions
- **Developer-friendly**: No Mac App Store restrictions, fast iteration

### 16. Business Model & Community
- **Free and open source**: MIT license, public GitHub repository
- **Community-driven**: Accept contributions, user feedback, transparent development
- **Focus on adoption**: Get users first, consider monetization later
- **Future options**: Donations, premium features, enterprise support if needed

---

## 🧠 User Flows

### First Time
1. Launch app
2. Click “Add Folder to Scan”
3. Select folder
4. Choose services to import
5. Services appear in tray

### Daily Use
- Open tray
- Start/stop services or groups
- Quit to stop all

### Optional
- Add services manually
- Create groups
- Auto-run last session

---

## 🧱 Tech Stack
- **Electron** - Cross-platform desktop app framework
- **TypeScript** - Type-safe JavaScript development
- **Node.js** - Backend services and process management
- **Winston** - Structured logging
- **fs-extra** - Enhanced file system operations
- **JSON-based storage** in `~/.runbar/`

---

## 🗂️ File Structure

```
runbar/
├── src/
│   ├── index.ts              # Main entry point
│   ├── processManager.ts     # Service process management
│   ├── storage.ts           # Configuration persistence
│   ├── scanner.ts           # Service discovery
│   ├── trayMenu.ts          # Tray menu UI
│   ├── types.ts             # TypeScript definitions
│   └── serviceIgnore.ts     # Ignore patterns
├── dist/                    # Compiled JavaScript
├── assets/                  # App icons and resources
├── tests/                   # Test files
├── docs/                    # Documentation
└── config/                  # Build configuration
```

---

## ✅ Feature Checklist

- [x] **Core Features**
  - [x] Tray menu with toggleable services
  - [x] Add folder → scan → import flow
  - [x] Group management and batch control
  - [x] JSON-based persistent config
  - [x] Graceful process management

- [x] **Enhanced Service Discovery**
  - [x] 15+ project types supported
  - [x] Smart command detection
  - [x] Framework auto-detection
  - [x] Intelligent naming

- [x] **Real-time Monitoring**
  - [x] Live service status indicators
  - [x] Real-time log streaming
  - [x] Port conflict detection
  - [x] Auto-restart on crash

- [x] **Advanced Group Management**
  - [x] Bulk operations (start/stop/restart all)
  - [x] Group management (rename/duplicate/delete)
  - [x] Service management (add/remove from groups)

- [x] **Modern Settings UI**
  - [x] Beautiful dark theme interface
  - [x] Theme customization
  - [x] Configuration management
  - [x] Export/import functionality

- [x] **Production Ready**
  - [x] TypeScript implementation
  - [x] Error handling and validation
  - [x] Data migration support
  - [x] Continuous development setup

---

## ⏭️ Future Ideas

- Logs viewer per service
- Restart on crash
- Docker support
- Notifications
- Cross-platform support
- **Conventional auto-update**: Check for updates on startup, notify user, manual install
- **Global hotkeys** and customizable shortcuts (power user features)
- **Multi-language support** and localization (when user demand exists)
- **Advanced testing**: CI/CD pipeline, automated UI testing
- **Mac App Store** distribution (if broader audience needed)
- **Premium features** and enterprise support (if user demand exists)
