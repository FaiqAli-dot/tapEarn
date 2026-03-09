import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'

interface ProtectedAdminRouteProps {
  children: React.ReactNode
  allowedUserIds?: string[]
}

const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ 
  children, 
  allowedUserIds = ['123456789', 'admin'] // Default admin user IDs
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Get current user ID from URL, localStorage, or app state
  const getCurrentUserId = () => {
    // First check URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const urlUserId = urlParams.get('userId')
    console.log('🔍 URL User ID detected:', urlUserId)
    
    if (urlUserId) return urlUserId
    
    // Check localStorage for stored user ID
    const storedUserId = localStorage.getItem('current_user_id')
    console.log('🔍 Stored User ID detected:', storedUserId)
    
    if (storedUserId) return storedUserId
    
    // Check if we're in development mode and allow access
    if (import.meta.env.DEV) {
      console.log('🔍 Development mode detected, using dev-admin')
      return 'dev-admin'
    }
    
    console.log('🔍 No user ID found')
    return null
  }

  const currentUserId = getCurrentUserId()

  useEffect(() => {
    console.log(`🔐 Admin Access Check:`, {
      currentUserId,
      allowedUserIds,
      isDev: import.meta.env.DEV,
      hasStoredPassword: !!localStorage.getItem('admin_password'),
      url: window.location.href
    })

    // Check if admin password is stored (highest priority)
    const storedPassword = localStorage.getItem('admin_password')
    if (storedPassword === 'tapEarn2024') {
      console.log(`✅ Admin access granted via stored password`)
      setIsAuthenticated(true)
      return
    }

    // Check if current user ID is in allowed list
    if (currentUserId && allowedUserIds.includes(currentUserId)) {
      console.log(`✅ Admin access granted for user: ${currentUserId}`)
      setIsAuthenticated(true)
      return
    }

    // If neither condition is met, show login form
    console.log(`❌ Admin access denied for user: ${currentUserId}`)
    setShowLogin(true)
  }, [currentUserId, allowedUserIds])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password === 'tapEarn2024') {
      localStorage.setItem('admin_password', password)
      setIsAuthenticated(true)
      setShowLogin(false)
    } else {
      setError('Invalid password')
    }
  }

  // If authenticated, show the admin content
  if (isAuthenticated) {
    return <>{children}</>
  }

  // If not authenticated and not showing login, redirect
  if (!showLogin) {
    return <Navigate to="/" replace />
  }

  // Show login form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">🔐 Admin Access</h1>
          <p className="text-gray-600">Enter admin password to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Admin Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            🔓 Access Admin Panel
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => window.history.back()}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Go Back
          </button>
        </div>

        {import.meta.env.DEV && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              <strong>Development Mode:</strong> Use password: <code>tapEarn2024</code>
            </p>
            <div className="mt-2 space-x-2">
              <button
                onClick={() => {
                  localStorage.removeItem('admin_password')
                  window.location.reload()
                }}
                className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
              >
                Clear Password
              </button>
              <button
                onClick={() => {
                  console.log('Current URL:', window.location.href)
                  console.log('URL Params:', new URLSearchParams(window.location.search).toString())
                  console.log('Stored Password:', localStorage.getItem('admin_password'))
                  console.log('Stored User ID:', localStorage.getItem('current_user_id'))
                }}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
              >
                Debug Info
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('current_user_id', '123456789')
                  window.location.reload()
                }}
                className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
              >
                Set Admin User
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProtectedAdminRoute
