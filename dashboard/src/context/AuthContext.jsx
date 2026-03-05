import React, { createContext, useContext, useState, useEffect, useRef } from 'react'

const AuthContext = createContext(null)

const API_URL = import.meta.env.VITE_API_URL || ''

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'))
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'))

  // Mutex per evitare refresh concorrenti
  const refreshPromiseRef = useRef(null)

  // Check auth status on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setTenant(data.tenant)
        setAccessToken(token)
      } else if (res.status === 401) {
        const refreshed = await refreshAccessToken()
        if (!refreshed) {
          logout()
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshAccessToken = async () => {
    // Se un refresh è già in corso, aspetta quello
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current
    }

    const refresh = localStorage.getItem('refreshToken')
    if (!refresh) return false

    // Crea la promise e salvala nel ref
    refreshPromiseRef.current = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken: refresh })
        })

        if (res.ok) {
          const data = await res.json()
          localStorage.setItem('accessToken', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)
          setAccessToken(data.accessToken)
          setRefreshToken(data.refreshToken)
          setUser(data.user)
          setTenant(data.tenant)
          return true
        }
      } catch (error) {
        console.error('Token refresh failed:', error)
      }
      return false
    })()

    try {
      return await refreshPromiseRef.current
    } finally {
      refreshPromiseRef.current = null
    }
  }

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Login fallito')
    }

    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    setAccessToken(data.accessToken)
    setRefreshToken(data.refreshToken)
    setUser(data.user)
    setTenant(data.currentTenant)

    return data
  }

  const logout = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    }

    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setAccessToken(null)
    setRefreshToken(null)
    setUser(null)
    setTenant(null)
  }

  // Helper per chiamate API autenticate
  const authFetch = async (url, options = {}) => {
    // Sempre da localStorage per evitare closure stale
    let token = localStorage.getItem('accessToken')
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }

    let res = await fetch(url, { ...options, headers })

    // Se 401, prova a refreshare il token (con mutex)
    if (res.status === 401) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        headers['Authorization'] = `Bearer ${localStorage.getItem('accessToken')}`
        res = await fetch(url, { ...options, headers })
      } else {
        logout()
        throw new Error('Sessione scaduta')
      }
    }

    return res
  }

  const value = {
    user,
    tenant,
    loading,
    isAuthenticated: !!user,
    accessToken,
    login,
    logout,
    authFetch,
    checkAuth
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
