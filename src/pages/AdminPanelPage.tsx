import React, { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  EyeOff,
  KeyRound,
  LogOut,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Trash2,
  Video
} from 'lucide-react'
import { apiService, type AdminCampaign, type AdminCampaignStats } from '../services/api'

type Tab = 'ads' | 'videos' | 'credentials'

interface VideoCodeRow {
  _id?: string
  taskId: string
  videoUrl: string
  code: string
  hint: string
  timeToShow: number
  points: number
  isActive: boolean
}

const emptyAd = (): Partial<AdminCampaign> => ({
  title: '',
  url: '',
  type: 'SPONSORED_POST',
  rewardPoints: 100,
  description: '',
  status: 'ACTIVE'
})

const emptyVideo = (): VideoCodeRow => ({
  taskId: '',
  videoUrl: '',
  code: '',
  hint: 'Look for the code that appears in the video',
  timeToShow: 0.5,
  points: 100,
  isActive: true
})

const AdminPanelPage: React.FC = () => {
  const [tokenReady, setTokenReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [username, setUsername] = useState('')
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const [tab, setTab] = useState<Tab>('ads')
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([])
  const [videos, setVideos] = useState<VideoCodeRow[]>([])
  const [editingAd, setEditingAd] = useState<Partial<AdminCampaign> | null>(null)
  const [editingVideo, setEditingVideo] = useState<VideoCodeRow | null>(null)
  const [statsMap, setStatsMap] = useState<Record<string, AdminCampaignStats | null>>({})
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [credCurrent, setCredCurrent] = useState('')
  const [credUser, setCredUser] = useState('')
  const [credPass, setCredPass] = useState('')

  const showBanner = (type: 'ok' | 'err', text: string) => {
    setBanner({ type, text })
    window.setTimeout(() => setBanner(null), 4000)
  }

  const refreshCampaigns = useCallback(async () => {
    const list = await apiService.adminListCampaigns()
    setCampaigns(list)
  }, [])

  const refreshVideos = useCallback(async () => {
    const list = await apiService.getAllVideoCodes('admin-panel')
    setVideos(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!apiService.getAdminPanelToken()) {
        if (!cancelled) {
          setTokenReady(true)
          setAuthed(false)
        }
        return
      }
      try {
        const me = await apiService.adminPanelMe()
        if (!cancelled) {
          setUsername(me.user?.username || '')
          setAuthed(true)
        }
      } catch {
        apiService.clearAdminPanelSession()
        if (!cancelled) setAuthed(false)
      } finally {
        if (!cancelled) setTokenReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!authed) return
    refreshCampaigns().catch(() => showBanner('err', 'Failed to load campaigns'))
    refreshVideos().catch(() => showBanner('err', 'Failed to load video codes'))
  }, [authed, refreshCampaigns, refreshVideos])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoggingIn(true)
    setLoginError('')
    try {
      const result = await apiService.adminPanelLogin(loginUser, loginPass)
      setUsername(result.user?.username || loginUser)
      setAuthed(true)
      setLoginPass('')
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = () => {
    apiService.clearAdminPanelSession()
    setAuthed(false)
    setUsername('')
  }

  const saveAd = async () => {
    if (!editingAd?.title?.trim()) {
      showBanner('err', 'Title is required')
      return
    }
    setBusy(true)
    try {
      const payload = {
        title: editingAd.title.trim(),
        url: (editingAd.url || '').trim(),
        type: (editingAd.type as 'SPONSORED_POST' | 'VIDEO') || 'SPONSORED_POST',
        rewardPoints: Number(editingAd.rewardPoints) || 100,
        description: editingAd.description || '',
        status: editingAd.status || 'ACTIVE'
      }
      if (editingAd._id) {
        await apiService.adminUpdateCampaign(editingAd._id, payload)
        showBanner('ok', 'Ad updated')
      } else {
        await apiService.adminCreateCampaign(payload)
        showBanner('ok', 'Ad created — visible to Mini App users')
      }
      setEditingAd(null)
      await refreshCampaigns()
    } catch (err: any) {
      showBanner('err', err?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const deactivateAd = async (id: string) => {
    setBusy(true)
    try {
      await apiService.adminDeactivateCampaign(id)
      showBanner('ok', 'Ad deactivated')
      await refreshCampaigns()
    } catch (err: any) {
      showBanner('err', err?.message || 'Deactivate failed')
    } finally {
      setBusy(false)
    }
  }

  const deleteAd = async (id: string) => {
    if (!window.confirm('Permanently delete this ad/campaign?')) return
    setBusy(true)
    try {
      await apiService.adminDeleteCampaign(id)
      showBanner('ok', 'Ad deleted')
      await refreshCampaigns()
    } catch (err: any) {
      showBanner('err', err?.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const loadStats = async (id: string) => {
    try {
      const stats = await apiService.adminCampaignStats(id)
      setStatsMap((prev) => ({ ...prev, [id]: stats }))
    } catch (err: any) {
      showBanner('err', err?.message || 'Stats failed')
    }
  }

  const saveVideo = async () => {
    if (!editingVideo?.taskId?.trim()) {
      showBanner('err', 'Task ID is required')
      return
    }
    setBusy(true)
    try {
      await apiService.createOrUpdateVideoCode(editingVideo.taskId, {
        videoUrl: editingVideo.videoUrl,
        code: editingVideo.code,
        hint: editingVideo.hint,
        timeToShow: editingVideo.timeToShow,
        points: editingVideo.points,
        isActive: editingVideo.isActive
      }, 'admin-panel')
      setEditingVideo(null)
      showBanner('ok', 'Video code saved')
      await refreshVideos()
    } catch (err: any) {
      showBanner('err', err?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const deleteVideo = async (taskId: string) => {
    if (!window.confirm('Delete this video code?')) return
    setBusy(true)
    try {
      await apiService.deleteVideoCode(taskId, 'admin-panel')
      showBanner('ok', 'Video code deleted')
      await refreshVideos()
    } catch (err: any) {
      showBanner('err', err?.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const saveCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const result = await apiService.adminPanelChangeCredentials({
        currentPassword: credCurrent,
        newUsername: credUser.trim() || undefined,
        newPassword: credPass || undefined
      })
      setUsername(result.user?.username || username)
      setCredCurrent('')
      setCredUser('')
      setCredPass('')
      showBanner('ok', 'Credentials updated — use them next login')
    } catch (err: any) {
      showBanner('err', err?.message || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  if (!tokenReady) {
    return (
      <div className="yorza-public min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-yorza-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="yorza-public min-h-screen flex items-center justify-center px-5">
        <div className="yorza-public__bg" aria-hidden />
        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleLogin}
          className="relative z-10 w-full max-w-md yorza-panel p-8"
        >
          <p className="font-yorza-display text-2xl tracking-[0.2em] text-yorza-gold mb-2">YORZA</p>
          <h1 className="font-yorza-body text-xl font-semibold mb-6">Admin panel</h1>
          <label className="block text-sm text-white/60 mb-1">Username</label>
          <input
            className="yorza-input mb-4"
            value={loginUser}
            onChange={(e) => setLoginUser(e.target.value)}
            autoComplete="username"
            required
          />
          <label className="block text-sm text-white/60 mb-1">Password</label>
          <input
            type="password"
            className="yorza-input mb-6"
            value={loginPass}
            onChange={(e) => setLoginPass(e.target.value)}
            autoComplete="current-password"
            required
          />
          {loginError && <p className="text-red-400 text-sm mb-4">{loginError}</p>}
          <button type="submit" disabled={loggingIn} className="yorza-cta w-full py-3 font-semibold text-black">
            {loggingIn ? 'Signing in…' : 'Sign in'}
          </button>
        </motion.form>
      </div>
    )
  }

  return (
    <div className="yorza-public min-h-screen text-white">
      <div className="yorza-public__bg" aria-hidden />
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="font-yorza-display text-xl tracking-[0.2em] text-yorza-gold">YORZA</p>
            <p className="text-sm text-white/50 mt-1">Admin · {username}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-yorza-cyan transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </header>

        <AnimatePresence>
          {banner && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mb-4 px-4 py-3 text-sm rounded border ${
                banner.type === 'ok'
                  ? 'border-yorza-cyan/40 bg-yorza-cyan/10 text-yorza-cyan'
                  : 'border-red-500/40 bg-red-500/10 text-red-300'
              }`}
            >
              {banner.text}
            </motion.div>
          )}
        </AnimatePresence>

        <nav className="flex flex-wrap gap-2 mb-8">
          {(
            [
              { id: 'ads' as Tab, label: 'Monetized ads', icon: Megaphone },
              { id: 'videos' as Tab, label: 'Video codes', icon: Video },
              { id: 'credentials' as Tab, label: 'Credentials', icon: KeyRound }
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm transition-colors border ${
                tab === id
                  ? 'border-yorza-gold/60 text-yorza-gold bg-yorza-gold/10'
                  : 'border-white/10 text-white/60 hover:border-white/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {tab === 'ads' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-yorza-body text-lg font-semibold">Campaigns & ads</h2>
              <button
                type="button"
                onClick={() => setEditingAd(emptyAd())}
                className="yorza-cta inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black"
              >
                <Plus className="w-4 h-4" />
                Add ad
              </button>
            </div>

            {editingAd && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="yorza-panel p-5 mb-6 space-y-3"
              >
                <h3 className="font-medium text-yorza-cyan">
                  {editingAd._id ? 'Edit campaign' : 'New monetized ad'}
                </h3>
                <input
                  className="yorza-input"
                  placeholder="Title"
                  value={editingAd.title || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, title: e.target.value })}
                />
                <input
                  className="yorza-input"
                  placeholder="Link URL"
                  value={editingAd.url || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, url: e.target.value })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    className="yorza-input"
                    value={editingAd.type || 'SPONSORED_POST'}
                    onChange={(e) =>
                      setEditingAd({
                        ...editingAd,
                        type: e.target.value as 'SPONSORED_POST' | 'VIDEO'
                      })
                    }
                  >
                    <option value="SPONSORED_POST">Sponsored post</option>
                    <option value="VIDEO">Video</option>
                  </select>
                  <input
                    type="number"
                    className="yorza-input"
                    placeholder="Reward YP"
                    value={editingAd.rewardPoints ?? 100}
                    onChange={(e) =>
                      setEditingAd({ ...editingAd, rewardPoints: Number(e.target.value) || 0 })
                    }
                  />
                  <select
                    className="yorza-input"
                    value={editingAd.status || 'ACTIVE'}
                    onChange={(e) => setEditingAd({ ...editingAd, status: e.target.value })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <textarea
                  className="yorza-input"
                  rows={2}
                  placeholder="Description (optional)"
                  value={editingAd.description || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, description: e.target.value })}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={saveAd}
                    className="yorza-cta inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAd(null)}
                    className="px-4 py-2 text-sm border border-white/20 text-white/70"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}

            <div className="space-y-3">
              {campaigns.length === 0 && (
                <p className="text-white/40 text-sm">No campaigns yet. Add a title + link ad.</p>
              )}
              {campaigns.map((c) => (
                <div key={c._id} className="yorza-panel p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.title}</p>
                      <p className="text-xs text-yorza-cyan/80 truncate mt-1">{c.url || '—'}</p>
                      <p className="text-xs text-white/40 mt-2">
                        {c.type} · {c.rewardPoints} YP · {c.status}
                        {c.completionCount != null ? ` · ${c.completionCount} completions` : ''}
                      </p>
                      {statsMap[c._id] && (
                        <p className="text-xs text-yorza-gold/80 mt-2 flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          Stats: {statsMap[c._id]?.completionCount ?? 0} completions ·{' '}
                          {statsMap[c._id]?.totalRewardDistributed ?? 0} YP paid ·{' '}
                          {statsMap[c._id]?.status}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        title="Stats"
                        onClick={() => loadStats(c._id)}
                        className="p-2 border border-white/15 text-white/60 hover:text-yorza-cyan"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => setEditingAd({ ...c })}
                        className="p-2 border border-white/15 text-white/60 hover:text-yorza-gold"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {c.status === 'ACTIVE' && (
                        <button
                          type="button"
                          title="Deactivate"
                          onClick={() => deactivateAd(c._id)}
                          className="p-2 border border-white/15 text-white/60 hover:text-amber-300"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => deleteAd(c._id)}
                        className="p-2 border border-white/15 text-white/60 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'videos' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-yorza-body text-lg font-semibold">Video codes</h2>
              <button
                type="button"
                onClick={() => setEditingVideo(emptyVideo())}
                className="yorza-cta inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black"
              >
                <Plus className="w-4 h-4" />
                Add code
              </button>
            </div>

            {editingVideo && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="yorza-panel p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <input
                  className="yorza-input"
                  placeholder="Task ID"
                  value={editingVideo.taskId}
                  onChange={(e) => setEditingVideo({ ...editingVideo, taskId: e.target.value })}
                />
                <input
                  className="yorza-input"
                  placeholder="Video URL"
                  value={editingVideo.videoUrl}
                  onChange={(e) => setEditingVideo({ ...editingVideo, videoUrl: e.target.value })}
                />
                <input
                  className="yorza-input font-mono"
                  placeholder="Code"
                  value={editingVideo.code}
                  onChange={(e) =>
                    setEditingVideo({ ...editingVideo, code: e.target.value.toUpperCase() })
                  }
                />
                <input
                  type="number"
                  className="yorza-input"
                  placeholder="Points"
                  value={editingVideo.points}
                  onChange={(e) =>
                    setEditingVideo({ ...editingVideo, points: Number(e.target.value) || 0 })
                  }
                />
                <input
                  type="number"
                  step="0.1"
                  className="yorza-input"
                  placeholder="Time to show (0–1)"
                  value={editingVideo.timeToShow}
                  onChange={(e) =>
                    setEditingVideo({
                      ...editingVideo,
                      timeToShow: Number(e.target.value) || 0.5
                    })
                  }
                />
                <select
                  className="yorza-input"
                  value={editingVideo.isActive ? '1' : '0'}
                  onChange={(e) =>
                    setEditingVideo({ ...editingVideo, isActive: e.target.value === '1' })
                  }
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
                <textarea
                  className="yorza-input sm:col-span-2"
                  rows={2}
                  placeholder="Hint"
                  value={editingVideo.hint}
                  onChange={(e) => setEditingVideo({ ...editingVideo, hint: e.target.value })}
                />
                <div className="sm:col-span-2 flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={saveVideo}
                    className="yorza-cta inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingVideo(null)}
                    className="px-4 py-2 text-sm border border-white/20 text-white/70"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}

            <div className="space-y-3">
              {videos.map((v) => (
                <div key={v._id || v.taskId} className="yorza-panel p-4 flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-medium">{v.taskId}</p>
                    <p className="text-xs font-mono text-yorza-cyan mt-1">{v.code}</p>
                    <p className="text-xs text-white/40 mt-1">
                      {v.points} pts · {v.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingVideo(v)}
                      className="p-2 border border-white/15 text-white/60 hover:text-yorza-gold"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVideo(v.taskId)}
                      className="p-2 border border-white/15 text-white/60 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'credentials' && (
          <section className="yorza-panel p-6 max-w-md">
            <h2 className="font-yorza-body text-lg font-semibold mb-4">Change login</h2>
            <form onSubmit={saveCredentials} className="space-y-3">
              <div>
                <label className="block text-sm text-white/60 mb-1">Current password</label>
                <input
                  type="password"
                  className="yorza-input"
                  value={credCurrent}
                  onChange={(e) => setCredCurrent(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">New username (optional)</label>
                <input
                  className="yorza-input"
                  value={credUser}
                  onChange={(e) => setCredUser(e.target.value)}
                  placeholder={username}
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">New password (optional)</label>
                <input
                  type="password"
                  className="yorza-input"
                  value={credPass}
                  onChange={(e) => setCredPass(e.target.value)}
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="yorza-cta px-5 py-2.5 text-sm font-semibold text-black"
              >
                Save credentials
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  )
}

export default AdminPanelPage
