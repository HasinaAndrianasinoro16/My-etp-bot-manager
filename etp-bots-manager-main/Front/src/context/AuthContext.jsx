// src/context/AuthContext.jsx 

import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

/* eslint-disable react-refresh/only-export-components */

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setUser(parsed)
      } catch (e) {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    try {
      const result = await api.login(email, password)
      if (result.status === 'success') {
        setUser(result.user)
        const destination = result.user.role === 'admin' ? '/admin' : '/user'
        navigate(destination, { replace: true })
      }
    } catch (err) {
      throw new Error(err.message || 'Identifiants incorrects')
    }
  }

  const logout = async () => {
    try {
      await api.logout()
    } catch (err) {
      console.warn('Logout failed', err)
    }
    setUser(null)
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}