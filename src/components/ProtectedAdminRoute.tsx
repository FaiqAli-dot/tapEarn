import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { apiService } from '../services/api'

interface ProtectedAdminRouteProps {
  children: React.ReactNode
}

/**
 * Video-code admin requires backend ADMIN_TELEGRAM_IDS JWT.
 * Normal users are redirected — full admin dashboard is Phase 4.
 */
const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    let cancelled = false
    apiService
      .checkAdminAccess()
      .then((allowed) => {
        if (!cancelled) setStatus(allowed ? 'allowed' : 'denied')
      })
      .catch(() => {
        if (!cancelled) setStatus('denied')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (status === 'denied') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default ProtectedAdminRoute
