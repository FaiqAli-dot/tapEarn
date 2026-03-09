import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, Trash2, Plus, Edit, Eye, EyeOff, LogOut } from 'lucide-react'
import { apiService } from '../services/api'

interface VideoCode {
  _id?: string
  taskId: string
  videoUrl: string
  code: string
  hint: string
  timeToShow: number
  points: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

const VideoCodeAdmin: React.FC = () => {
  const [videoCodes, setVideoCodes] = useState<VideoCode[]>([])
  const [editingCode, setEditingCode] = useState<VideoCode | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchVideoCodes()
  }, [])

  const fetchVideoCodes = async () => {
    try {
      setIsLoading(true)
      const codes = await apiService.getAllVideoCodes()
      setVideoCodes(codes)
    } catch (error) {
      console.error('Failed to fetch video codes:', error)
      setError('Failed to load video codes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (videoCode: VideoCode) => {
    try {
      await apiService.createOrUpdateVideoCode(videoCode.taskId, {
        videoUrl: videoCode.videoUrl,
        code: videoCode.code,
        hint: videoCode.hint,
        timeToShow: videoCode.timeToShow,
        points: videoCode.points,
        isActive: videoCode.isActive
      })
      
      setEditingCode(null)
      fetchVideoCodes()
    } catch (error) {
      console.error('Failed to save video code:', error)
      setError('Failed to save video code')
    }
  }

  const handleDelete = async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this video code?')) {
      try {
        await apiService.deleteVideoCode(taskId)
        fetchVideoCodes()
      } catch (error) {
        console.error('Failed to delete video code:', error)
        setError('Failed to delete video code')
      }
    }
  }

  const handleEdit = (code: VideoCode) => {
    setEditingCode(code)
  }

  const handleCancel = () => {
    setEditingCode(null)
  }

  const handleAddNew = () => {
    setEditingCode({
      taskId: '',
      videoUrl: '',
      code: '',
      hint: 'Look for the code that appears in the video',
      timeToShow: 0.5,
      points: 100,
      isActive: true
    })
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_password')
    window.location.href = '/'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Video Code Management</h1>
          <p className="text-sm text-gray-600 mt-1">🔐 Admin Panel - Manage video codes and rewards</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAddNew}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add New</span>
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Add/Edit Form */}
      {editingCode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-md p-6 mb-6"
        >
          <h2 className="text-lg font-semibold mb-4">
            {editingCode._id ? 'Edit Video Code' : 'Add New Video Code'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task ID
              </label>
              <input
                type="text"
                value={editingCode.taskId}
                onChange={(e) => setEditingCode({ ...editingCode, taskId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., watch_youtube"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Video URL
              </label>
              <input
                type="url"
                value={editingCode.videoUrl}
                onChange={(e) => setEditingCode({ ...editingCode, videoUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
              </label>
              <input
                type="text"
                value={editingCode.code}
                onChange={(e) => setEditingCode({ ...editingCode, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="TAP2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Points
              </label>
              <input
                type="number"
                value={editingCode.points}
                onChange={(e) => setEditingCode({ ...editingCode, points: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time to Show (0-1)
              </label>
              <input
                type="number"
                step="0.1"
                value={editingCode.timeToShow}
                onChange={(e) => setEditingCode({ ...editingCode, timeToShow: parseFloat(e.target.value) || 0.5 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={editingCode.isActive ? 'active' : 'inactive'}
                onChange={(e) => setEditingCode({ ...editingCode, isActive: e.target.value === 'active' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hint
              </label>
              <textarea
                value={editingCode.hint}
                onChange={(e) => setEditingCode({ ...editingCode, hint: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Look for the code that appears in the video"
              />
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={() => handleSave(editingCode)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Video Codes List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Video Codes</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Task ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {videoCodes.map((code) => (
                <tr key={code._id || code.taskId}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{code.taskId}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">{code.videoUrl}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono font-bold text-blue-600">{code.code}</div>
                    <div className="text-xs text-gray-500">{code.hint}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{code.points} points</div>
                    <div className="text-xs text-gray-500">{Math.round(code.timeToShow * 100)}% of video</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      code.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {code.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(code)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(code.taskId)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default VideoCodeAdmin
