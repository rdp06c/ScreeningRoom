import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const AVATAR_EMOJIS = [
  // Faces
  '\uD83D\uDE0E', '\uD83E\uDD13', '\uD83E\uDD78', '\uD83E\uDD20',
  '\uD83D\uDE0D', '\uD83E\uDD29', '\uD83E\uDDD0', '\uD83E\uDD2F',
  // Characters
  '\uD83D\uDC7B', '\uD83D\uDC7D', '\uD83E\uDD16', '\uD83E\uDD84',
  '\uD83E\uDDDB', '\uD83E\uDDDC', '\uD83E\uDDD9', '\uD83E\uDDE0',
  // Animals
  '\uD83D\uDC36', '\uD83D\uDC31', '\uD83E\uDD8A', '\uD83D\uDC3B',
  '\uD83D\uDC27', '\uD83E\uDD89', '\uD83E\uDD8B', '\uD83D\uDC19',
  '\uD83E\uDDA5', '\uD83D\uDC38', '\uD83E\uDD8E', '\uD83D\uDC2C',
  '\uD83D\uDC3C', '\uD83E\uDD81', '\uD83D\uDC2F', '\uD83E\uDD88',
  '\uD83E\uDD9C', '\uD83D\uDC22', '\uD83E\uDDA6', '\uD83E\uDDA9',
  // Food & Objects
  '\uD83C\uDF55', '\uD83C\uDF69', '\uD83C\uDF36\uFE0F', '\uD83E\uDDC1',
  '\uD83C\uDFA8', '\uD83C\uDFAC', '\uD83C\uDFB8', '\uD83C\uDFAE',
  // Nature & Space
  '\uD83C\uDF1F', '\uD83C\uDF3B', '\uD83C\uDF35', '\uD83C\uDF44',
  '\uD83D\uDE80', '\uD83C\uDF19', '\uD83C\uDF0B', '\u26A1',
]

export default function ProfileModal({ onClose }) {
  const { user, profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [selectedAvatar, setSelectedAvatar] = useState(profile?.avatar_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('Display name is required.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: displayName.trim(),
          avatar_url: selectedAvatar || null,
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      await refreshProfile()
      setSuccess(true)
      setTimeout(() => onClose(), 600)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        <h2 className="profile-modal-title">Edit Profile</h2>

        <form onSubmit={handleSave}>
          <div className="profile-avatar-section">
            <div className="profile-avatar-preview">
              {selectedAvatar || (displayName || '?')[0].toUpperCase()}
            </div>
            <p className="profile-avatar-label">Pick your avatar</p>
          </div>

          <div className="profile-avatar-grid">
            <button
              type="button"
              className={`profile-avatar-option ${!selectedAvatar ? 'profile-avatar-option--selected' : ''}`}
              onClick={() => setSelectedAvatar('')}
            >
              {(displayName || '?')[0].toUpperCase()}
            </button>
            {AVATAR_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                className={`profile-avatar-option ${selectedAvatar === emoji ? 'profile-avatar-option--selected' : ''}`}
                onClick={() => setSelectedAvatar(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={30}
              placeholder="Your name"
            />
          </div>

          {error && <p className="form-error">{error}</p>}
          {success && <p className="profile-success">Saved!</p>}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
