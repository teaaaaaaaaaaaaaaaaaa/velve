import axios from 'axios'
import { auth } from '@/config/firebase'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
console.log('[APIClient] Creating client with baseURL:', API_URL)

const client = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: dodaje Firebase ID token u svaki zahtev
client.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
    console.log('[APIClient] Request:', config.method?.toUpperCase(), config.url, '(with auth)')
  } else {
    console.log('[APIClient] Request:', config.method?.toUpperCase(), config.url, '(no auth)')
  }
  return config
})

// Response interceptor: loguje odgovore i greške
client.interceptors.response.use(
  (response) => {
    console.log('[APIClient] Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.log('[APIClient] Error:', error.response?.status, error.config?.url, error.message)
    return Promise.reject(error)
  }
)

export default client
