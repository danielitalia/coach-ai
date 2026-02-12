import React, { useState, useEffect } from 'react'
import {
  Zap, Play, Clock, MessageSquare, CheckCircle, AlertCircle,
  ToggleLeft, ToggleRight, Edit2, Save, X, RefreshCw,
  TrendingUp, Send, Calendar, Award, UserMinus
} from 'lucide-react'

const API_URL = ''

function Automations() {
  const [sequences, setSequences] = useState([])
  const [stats, setStats] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [activeTab, setActiveTab] = useState('sequences')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [seqRes, statsRes, jobsRes] = await Promise.all([
        fetch(`${API_URL}/api/automations`),
        fetch(`${API_URL}/api/automations/stats`),
        fetch(`${API_URL}/api/automations/jobs?limit=50`)
      ])

      if (seqRes.ok) setSequences(await seqRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
      if (jobsRes.ok) setJobs(await jobsRes.json())
    } catch (err) {
      console.log('Errore fetch:', err)
      setMessage({ type: 'error', text: 'Errore nel caricamento dati' })
    } finally {
      setLoading(false)
    }
  }

  const triggerRun = async () => {
    setRunning(true)
    try {
      const res = await fetch(`${API_URL}/api/automations/run`, { method: 'POST' })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Automazioni eseguite!' })
        setTimeout(() => {
          fetchData()
          setMessage(null)
        }, 2000)
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore esecuzione' })
    } finally {
      setRunning(false)
    }
  }

  const toggleSequence = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/automations/${id}/toggle`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setSequences(sequences.map(s => s.id === id ? updated : s))
        setMessage({
          type: 'success',
          text: `Automazione ${updated.is_enabled ? 'attivata' : 'disattivata'}!`
        })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore aggiornamento' })
    }
  }

  const startEdit = (sequence) => {
    setEditingId(sequence.id)
    setEditForm({
      message_template: sequence.message_template,
      trigger_config: sequence.trigger_config
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/automations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      if (res.ok) {
        const updated = await res.json()
        setSequences(sequences.map(s => s.id === id ? updated : s))
        setMessage({ type: 'success', text: 'Messaggio salvato!' })
        setEditingId(null)
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore salvataggio' })
    }
  }

  const getTriggerIcon = (type) => {
    switch (type) {
      case 'inactivity': return UserMinus
      case 'checkin': return Calendar
      case 'milestone': return Award
      default: return Zap
    }
  }

  const getTriggerLabel = (type, config) => {
    switch (type) {
      case 'inactivity': return `Dopo ${config.days} giorni di inattività`
      case 'checkin': return `${config.delay_minutes} minuti dopo check-in`
      case 'milestone': return `Streak di ${config.streak} giorni`
      default: return type
    }
  }

  const getTriggerColor = (type) => {
    switch (type) {
      case 'inactivity': return 'bg-orange-100 text-orange-600'
      case 'checkin': return 'bg-green-100 text-green-600'
      case 'milestone': return 'bg-purple-100 text-purple-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    const d = new Date(date)
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-7 h-7 text-yellow-500" />
            Marketing Automation
          </h2>
          <p className="text-gray-500 mt-1">Messaggi WhatsApp automatici basati sul comportamento clienti</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Aggiorna
          </button>
          <button
            onClick={triggerRun}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Esecuzione...' : 'Esegui Ora'}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.sent || 0}</p>
                <p className="text-sm text-gray-500">Inviati</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.failed || 0}</p>
                <p className="text-sm text-gray-500">Falliti</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-green-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.last_24h || 0}</p>
                <p className="text-sm text-gray-500">Ultime 24h</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${
                stats.schedulerRunning ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <div className={`w-3 h-3 rounded-full ${
                  stats.schedulerRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`} />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {stats.schedulerRunning ? 'Attivo' : 'Fermo'}
                </p>
                <p className="text-sm text-gray-500">Scheduler</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('sequences')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'sequences'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sequenze ({sequences.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'history'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Storico Invii ({jobs.length})
          </button>
        </div>
      </div>

      {/* Sequences Tab */}
      {activeTab === 'sequences' && (
        <div className="space-y-4">
          {sequences.map((seq) => {
            const Icon = getTriggerIcon(seq.trigger_type)
            const isEditing = editingId === seq.id

            return (
              <div
                key={seq.id}
                className={`bg-white rounded-xl border ${seq.is_enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'} overflow-hidden`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getTriggerColor(seq.trigger_type)}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">
                            {seq.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            seq.is_enabled
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {seq.is_enabled ? 'Attivo' : 'Disattivato'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {getTriggerLabel(seq.trigger_type, seq.trigger_config)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <button
                          onClick={() => startEdit(seq)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Modifica messaggio"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleSequence(seq.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          seq.is_enabled
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={seq.is_enabled ? 'Disattiva' : 'Attiva'}
                      >
                        {seq.is_enabled ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Message Preview/Edit */}
                  <div className="mt-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editForm.message_template}
                          onChange={(e) => setEditForm({ ...editForm, message_template: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder="Messaggio da inviare..."
                        />
                        <p className="text-xs text-gray-500">
                          Variabili disponibili: {'{{client_name}}'}, {'{{gym_name}}'}, {'{{coach_name}}'}, {'{{days_inactive}}'}, {'{{streak}}'}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(seq.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm"
                          >
                            <Save className="w-4 h-4" />
                            Salva
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                          >
                            <X className="w-4 h-4" />
                            Annulla
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-600">{seq.message_template}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {jobs.length === 0 ? (
            <div className="p-12 text-center">
              <Send className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nessun messaggio automatico inviato</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Data</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Telefono</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Stato</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden md:table-cell">Messaggio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(job.executed_at)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        +{job.phone}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getTriggerColor(job.trigger_type)}`}>
                          {job.trigger_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {job.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            Inviato
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            Fallito
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate hidden md:table-cell">
                        {job.message_sent || job.error_message || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-blue-900">Esecuzione Automatica</h4>
            <p className="text-sm text-blue-700 mt-1">
              Le automazioni vengono eseguite automaticamente ogni ora alle :05.
              Puoi anche eseguirle manualmente cliccando "Esegui Ora".
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Automations
