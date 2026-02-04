import React, { useState, useEffect } from 'react'
import { Bell, Clock, MessageSquare, Save, Play, Users, CheckCircle, AlertCircle } from 'lucide-react'

const API_URL = ''

function Reminders() {
  const [config, setConfig] = useState({
    enabled: true,
    checkIntervalMinutes: 60,
    thresholds: []
  })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchConfig()
    fetchStats()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reminders/config`)
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch (err) {
      console.log('Errore fetch config:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reminders/stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.log('Errore fetch stats:', err)
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/reminders/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Configurazione salvata!' })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore nel salvataggio' })
    } finally {
      setSaving(false)
    }
  }

  const triggerCheck = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reminders/check`, { method: 'POST' })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Controllo promemoria eseguito!' })
        fetchStats()
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore nel controllo' })
    }
  }

  const updateThreshold = (index, field, value) => {
    const newThresholds = [...config.thresholds]
    newThresholds[index] = { ...newThresholds[index], [field]: value }
    setConfig({ ...config, thresholds: newThresholds })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Promemoria Automatici</h2>
          <p className="text-gray-500 mt-1">Riattiva i clienti inattivi con messaggi automatici</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={triggerCheck}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Play className="w-4 h-4" />
            Esegui Ora
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalClientTracked}</p>
                <p className="text-sm text-gray-500">Clienti tracciati</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Bell className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.remindersSent?.length || 0}</p>
                <p className="text-sm text-gray-500">Promemoria inviati</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                stats.remindersEnabled ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <div className={`w-3 h-3 rounded-full ${
                  stats.remindersEnabled ? 'bg-green-500' : 'bg-gray-400'
                }`} />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {stats.remindersEnabled ? 'Attivo' : 'Disattivato'}
                </p>
                <p className="text-sm text-gray-500">Stato sistema</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurazione</h3>

        <div className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Abilita promemoria automatici</p>
              <p className="text-sm text-gray-500">Invia messaggi ai clienti inattivi</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                config.enabled ? 'bg-primary-500' : 'bg-gray-300'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.enabled ? 'left-8' : 'left-1'
              }`} />
            </button>
          </div>

          {/* Check Interval */}
          <div>
            <label className="block font-medium text-gray-900 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              Intervallo di controllo
            </label>
            <select
              value={config.checkIntervalMinutes}
              onChange={(e) => setConfig({ ...config, checkIntervalMinutes: parseInt(e.target.value) })}
              className="w-full md:w-64 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={30}>Ogni 30 minuti</option>
              <option value={60}>Ogni ora</option>
              <option value={120}>Ogni 2 ore</option>
              <option value={360}>Ogni 6 ore</option>
              <option value={720}>Ogni 12 ore</option>
              <option value={1440}>Una volta al giorno</option>
            </select>
          </div>
        </div>
      </div>

      {/* Threshold Messages */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          <MessageSquare className="w-5 h-5 inline mr-2" />
          Messaggi di Promemoria
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Configura i messaggi che verranno inviati ai clienti in base ai giorni di inattività
        </p>

        <div className="space-y-4">
          {config.thresholds.map((threshold, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Dopo</span>
                  <input
                    type="number"
                    min="1"
                    value={threshold.days}
                    onChange={(e) => updateThreshold(index, 'days', parseInt(e.target.value))}
                    className="w-16 px-2 py-1 border border-gray-200 rounded text-center"
                  />
                  <span className="text-sm font-medium text-gray-600">giorni</span>
                </div>
              </div>
              <textarea
                value={threshold.message}
                onChange={(e) => updateThreshold(index, 'message', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Messaggio da inviare..."
              />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Reminders */}
      {stats?.remindersSent?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Promemoria Recenti</h3>
          <div className="space-y-2">
            {stats.remindersSent.map((reminder, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">+{reminder.phone}</span>
                <span className="text-sm text-gray-500">
                  Inviato dopo {reminder.reminderDays.join(', ')} giorni
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Reminders
