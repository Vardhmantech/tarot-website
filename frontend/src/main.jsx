import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'

// Admin screens use both the configured `api` instance and plain axios.
// Restore the token globally so both paths authenticate after a refresh.
const storedToken = localStorage.getItem('adminToken')
if (storedToken) {
  axios.defaults.headers.common.Authorization = `Bearer ${storedToken}`
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)