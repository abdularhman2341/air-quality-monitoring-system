import { io } from 'socket.io-client'
import { getToken } from '../api/client'

const API_URL = import.meta.env.VITE_API_URL
const LIVE_EVENTS = ['reading:new', 'alert:new', 'device:status']

let socket = null
const listeners = new Set()

// Socket.IO runs on the server root, not under /api/v1.
// A relative API_URL means the backend serves the site from the same domain.
function socketUrl () {
  return API_URL.startsWith('http') ? new URL(API_URL).origin : undefined
}

function notifyListeners () {
  listeners.forEach((listener) => listener())
}

export function connectSocket () {
  if (socket) {
    return
  }
  socket = io(socketUrl(), { auth: (send) => send({ token: getToken() }) })
  LIVE_EVENTS.forEach((event) => socket.on(event, notifyListeners))
  // Also fires after a reconnect, so anything missed offline is reloaded.
  socket.on('connect', notifyListeners)
}

export function disconnectSocket () {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function onLiveUpdate (listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
