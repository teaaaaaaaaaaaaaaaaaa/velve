const { spawn } = require('child_process')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const mobileRoot = path.join(repoRoot, 'apps', 'mobile')
const command = process.platform === 'win32' ? 'cmd.exe' : 'npx'
const args =
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx expo start --web']
    : ['expo', 'start', '--web']

const child = spawn(command, args, {
  cwd: mobileRoot,
  env: {
    ...process.env,
    EXPO_PUBLIC_DESIGN_PREVIEW: '1',
  },
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code || 0)
})
