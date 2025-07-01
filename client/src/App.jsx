import React, { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [connected, setConnected] = useState(false)
  const [monitoring, setMonitoring] = useState(false)
  const [messageCount, setMessageCount] = useState(0)
  const [messages, setMessages] = useState([])
  const wsRef = useRef(null)

  useEffect(() => {
    connectWebSocket()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8080')
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      sendMessage({ type: 'status' })
      sendMessage({ type: 'recent' })
    }

    ws.onclose = () => {
      setConnected(false)
      setTimeout(connectWebSocket, 3000)
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      handleMessage(message)
    }

    ws.onerror = () => {
      setConnected(false)
    }
  }

  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }

  const handleMessage = (message) => {
    switch (message.type) {
      case 'message':
        setMessages(prev => [message.data, ...prev.slice(0, 99)])
        setMessageCount(prev => prev + 1)
        break
      case 'status':
        setMonitoring(message.data.monitoring)
        if (message.data.messageCount !== undefined) {
          setMessageCount(message.data.messageCount)
        }
        break
      case 'recent':
        setMessages(message.data || [])
        break
      case 'cleared':
        setMessages([])
        setMessageCount(0)
        break
      case 'error':
        console.error('Server error:', message.data.message)
        break
    }
  }

  const formatData = (data) => {
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2)
    }
    return String(data)
  }

  return (
    <div className="app">
      <div className="container">
        <h1>Kafka Topic Monitor</h1>
        
        <div className="status">
          <span className={`status-item ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <span className={`status-item ${monitoring ? 'active' : 'stopped'}`}>
            {monitoring ? 'Active' : 'Stopped'}
          </span>
          <span className="status-item count">
            {messageCount} messages
          </span>
        </div>

        <div className="controls">
          <button 
            className="btn start" 
            onClick={() => sendMessage({ type: 'start' })}
            disabled={!connected}
          >
            Start
          </button>
          <button 
            className="btn stop" 
            onClick={() => sendMessage({ type: 'stop' })}
            disabled={!connected}
          >
            Stop
          </button>
          <button 
            className="btn clear" 
            onClick={() => sendMessage({ type: 'clear' })}
            disabled={!connected}
          >
            Clear
          </button>
        </div>

        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty">No messages yet</div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="message">
                <div className="message-header">
                  <span className="topic">{msg.topic}</span>
                  <span className="time">
                    {new Date(msg.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="content">
                  {formatData(msg.data)}
                </div>
                <div className="meta">
                  <span>Node: {msg.orgUsrNode}</span>
                  <span>Partition: {msg.partition}</span>
                  <span>Offset: {msg.offset}</span>
                  {msg.messageKey && <span>Key: {msg.messageKey}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default App