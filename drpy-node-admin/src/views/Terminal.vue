<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '../stores/theme'

const themeStore = useThemeStore()
const terminalContainer = ref(null)
const wsUrl = ref('')
const isConnected = ref(false)
const connectionError = ref('')

let term = null
let fitAddon = null
let ws = null
let resizeObserver = null

// Initialize Terminal
const initTerminal = () => {
  term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: getThemeColors()
  })
  
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  
  term.open(terminalContainer.value)
  fitAddon.fit()
  
  // Handle terminal resize
  term.onResize(({ cols, rows }) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  })
  
  // Handle user input
  term.onData(data => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })
  
  // Setup ResizeObserver to refit terminal when container changes
  resizeObserver = new ResizeObserver(() => {
    if (fitAddon) {
      try {
        fitAddon.fit()
      } catch (e) {
        // ignore
      }
    }
  })
  resizeObserver.observe(terminalContainer.value)
}

const getThemeColors = () => {
  const isDark = document.documentElement.classList.contains('dark')
  return {
    background: isDark ? '#1e1e1e' : '#ffffff',
    foreground: isDark ? '#d4d4d4' : '#333333',
    cursor: isDark ? '#ffffff' : '#000000',
    selectionBackground: isDark ? '#264f78' : '#cce2ff'
  }
}

// Watch for theme changes to update terminal colors
watch(() => themeStore.isDark, () => {
  if (term) {
    term.options.theme = getThemeColors()
  }
})

// Connect to WebSocket
const connect = () => {
  if (ws) {
    ws.close()
  }
  
  connectionError.value = ''
  
  try {
    let url = wsUrl.value || getDefaultWsUrl()
    
    // Extract auth from localStorage
    const auth = localStorage.getItem('drpy_auth')
    if (auth) {
      // Append auth to query string if not already present
      const urlObj = new URL(url)
      if (!urlObj.searchParams.has('auth')) {
        urlObj.searchParams.set('auth', auth)
        url = urlObj.toString()
      }
    }

    ws = new WebSocket(url)
    
    ws.onopen = () => {
      isConnected.value = true
      term.clear()
      term.writeln('\x1b[32m[✓] Connected to terminal\x1b[0m')
      
      // Send initial resize
      if (term.cols && term.rows) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    }
    
    ws.onmessage = async (event) => {
      let data = event.data
      if (data instanceof Blob) {
        data = await data.text()
      }
      term.write(data)
    }
    
    ws.onclose = () => {
      isConnected.value = false
      term.writeln('\r\n\x1b[31m[!] Disconnected from terminal\x1b[0m')
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      connectionError.value = '连接失败，请检查服务地址是否正确'
      isConnected.value = false
    }
  } catch (error) {
    connectionError.value = error.message
  }
}

const disconnect = () => {
  if (ws) {
    ws.close()
  }
}

const getDefaultWsUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/api/admin/terminal/ws`
}

onMounted(() => {
  wsUrl.value = getDefaultWsUrl()
  
  nextTick(() => {
    initTerminal()
    // Auto connect on load
    connect()
  })
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (ws) {
    ws.close()
  }
  if (term) {
    term.dispose()
  }
})
</script>

<template>
  <div class="h-full flex flex-col space-y-4">
    <!-- Header Controls -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div class="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div class="flex-1 w-full max-w-2xl">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            终端服务地址 (WebSocket URL)
          </label>
          <div class="flex gap-2">
            <input
              v-model="wsUrl"
              type="text"
              class="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-gray-100"
              placeholder="ws://localhost:3000/api/admin/terminal/ws"
              @keyup.enter="connect"
            />
            <button
              v-if="!isConnected"
              @click="connect"
              class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm whitespace-nowrap"
            >
              连接
            </button>
            <button
              v-else
              @click="disconnect"
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap"
            >
              断开
            </button>
          </div>
          <p v-if="connectionError" class="mt-1 text-sm text-red-500">
            {{ connectionError }}
          </p>
        </div>
        
        <div class="flex items-center gap-2">
          <span class="relative flex h-3 w-3">
            <span v-if="isConnected" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3" :class="isConnected ? 'bg-green-500' : 'bg-gray-400'"></span>
          </span>
          <span class="text-sm font-medium" :class="isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'">
            {{ isConnected ? '已连接' : '未连接' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Terminal Container -->
    <div class="flex-1 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-[400px]">
      <!-- Mac-like window controls for aesthetic -->
      <div class="h-8 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-2 select-none">
        <div class="w-3 h-3 rounded-full bg-red-500"></div>
        <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div class="w-3 h-3 rounded-full bg-green-500"></div>
        <div class="mx-auto text-xs text-gray-500 dark:text-gray-400 font-medium">Terminal</div>
      </div>
      
      <!-- Actual xterm.js container -->
      <div ref="terminalContainer" class="flex-1 p-2 terminal-wrapper w-full h-full overflow-hidden"></div>
    </div>
  </div>
</template>

<style>
.terminal-wrapper {
  /* Ensure xterm takes full height and width */
}
.terminal-wrapper .terminal {
  height: 100%;
}
.terminal-wrapper .xterm-viewport {
  /* custom scrollbar for terminal */
  scrollbar-width: thin;
}
</style>