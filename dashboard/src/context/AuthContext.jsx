import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const API_URL = ''

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'))
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'))

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
        // Try refresh token
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
    const refresh = localStorage.getItem('refreshToken')
    if (!refresh) return false

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
      if (accessToken) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
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
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`
    }

    let res = await fetch(url, { ...options, headers })

    // Se 401, prova a refreshare il token
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
