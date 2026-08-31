import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home,
  Coins,
  Users,
  Trophy,
  User,
} from 'lucide-react'

interface NavItem {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/daily-earn', label: 'Earn', icon: Coins },
  { path: '/invite-friends', label: 'Referrals', icon: Users },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/profile', label: 'Profile', icon: User },
]

const BottomNavigation: React.FC<{ currentPath: string }> = ({ currentPath }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const IconComponent = item.icon
          const isActive = currentPath === item.path

          return (
            <Link
              key={item.path}
              to={item.path}
              className="nav-item relative min-w-0 flex-1"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-blue-100 rounded-lg"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              <div className="relative z-10 flex flex-col items-center justify-center py-2 px-1">
                <IconComponent
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-blue-600' : 'text-gray-500'
                  }`}
                />
                <span
                  className={`text-[10px] mt-1 transition-colors truncate max-w-full ${
                    isActive ? 'text-blue-600 font-medium' : 'text-gray-500'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNavigation
