import axios from 'axios'

// Empty base URL = same origin. In development Vite proxies /api to the backend.
const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || ''

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
