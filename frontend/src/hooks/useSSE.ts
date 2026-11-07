import { useEffect, useRef, useState } from 'react'

export interface SSEEvent {
  event: string
  data: unknown
}

/**
 * Subscribe to the order SSE stream with native browser auto-reconnect.
 * `onEvent` receives each (event, data) pair; identity should be stable
 * or wrapped by the caller with useCallback.
 */
export function useSSE(url: string | null, onEvent: (ev: SSEEvent) => void) {
  const [connected, setConnected] = useState(false)
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    if (!url) return
    const source = new EventSource(url)
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)

    const events = [
      'connected',
      'order.created',
      'order.round_added',
      'order.status_changed',
      'order.completed',
      'order.cancelled',
      'table.status_changed',
    ]
    const listeners = events.map((name) => {
      const listener = (e: MessageEvent) => {
        let data: unknown = null
        try {
          data = e.data ? JSON.parse(e.data) : null
        } catch {
          data = e.data
        }
        handlerRef.current({ event: name, data })
      }
      source.addEventListener(name, listener as EventListener)
      return { name, listener }
    })

    return () => {
      listeners.forEach(({ name, listener }) =>
        source.removeEventListener(name, listener as EventListener),
      )
      source.close()
      setConnected(false)
    }
  }, [url])

  return { connected }
}
