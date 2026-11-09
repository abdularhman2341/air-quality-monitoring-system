import { io } from 'socket.io-client'
import { getToken } from '../api/client'

const API_URL = import.meta.env.VITE_API_URL
const LIVE_EVENTS = ['reading:new', 'alert:new', 'device:status']

let socket = null
let onServerDisconnect = null
const listeners = new Set()

export function setServerDisconnectHandler (handler) {
  onServerDisconnect = handler
}

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
  const current = io(socketUrl(), { auth: (send) => send({ token: getToken() }) })
  socket = current
  LIVE_EVENTS.forEach((event) => current.on(event, notifyListeners))
  // Also fires after a reconnect, so anything missed offline is reloaded.
  current.on('connect', notifyListeners)
  // The server closed the connection (session ended or signed out everywhere).
  // Socket.IO does not reconnect by itself in this case.
  current.on('disconnect', (reason) => {
    if (reason === 'io server disconnect' && socket === current) {
      socket = null
      if (onServerDisconnect) onServerDisconnect()
    }
  })
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
