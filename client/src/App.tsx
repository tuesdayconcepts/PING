/// <reference types="vite/client" />
import { useState, useEffect } from 'react'
import './App.css'

// Get API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function App() {
  const [items, setItems] = useState<Array<{ id: number; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch items from API on component mount
  useEffect(() => {
    fetch(`${API_URL}/api/v1/items`)
      .then(res => res.json())
      .then(data => {
        setItems(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return (
    <div className="app">
      <h1>PING</h1>
      <div className="card">
        {loading && <p>Loading...</p>}
        {error && <p className="error">Error: {error}</p>}
        {!loading && !error && (
          <ul>
            {items.map(item => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default App

