const { spawn } = require('child_process');
const { watch } = require('fs');
const path = require('path');

let electronProcess = null;

function startElectron() {
  console.log('🚀 Starting Electron app...');
  electronProcess = spawn('electron', ['.'], {
    stdio: 'inherit',
    shell: true
  });
  
  electronProcess.on('close', (code) => {
    console.log(`Electron process exited with code ${code}`);
  });
}

function stopElectron() {
  if (electronProcess) {
    console.log('🛑 Stopping Electron app...');
    electronProcess.kill('SIGTERM');
    electronProcess = null;
  }
}

function restartElectron() {
  stopElectron();
  setTimeout(startElectron, 1000); // Wait 1 second before restarting
}

// Watch for changes in the dist directory
console.log('👀 Watching for changes...');
watch(path.join(__dirname, 'dist'), { recursive: true }, (eventType, filename) => {
  if (filename && !filename.includes('.map')) {
    console.log(`📝 Detected change: ${filename}`);
    restartElectron();
  }
});

// Initial build and start
console.log('🔨 Building TypeScript...');
const buildProcess = spawn('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true
});

buildProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Build successful!');
    startElectron();
  } else {
    console.error('❌ Build failed!');
    process.exit(1);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  stopElectron();
  process.exit(0);
}); 