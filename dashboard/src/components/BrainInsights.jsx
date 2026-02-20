import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  Brain, AlertTriangle, TrendingUp, TrendingDown, Users,
  Activity, Zap, MessageSquare, RefreshCw, ChevronDown,
  ChevronUp, Clock, Target, Heart, Frown, Smile, Star,
  ArrowUp, ArrowDown, Minus
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function BrainInsights() {
  const { authFetch } = useAuth()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedClient, setExpandedClient] = useState(null)
  const [activeTab, setActiveTab] = useState('overview') // overview, clients, actions
  const [runningBrain, setRunningBrain] = useState(false)

  useEffect(() => {
    fetchOverview()
  }, [])

  const fetchOverview = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await authFetch(`${API_URL}/api/brain/overview`)
      if (res.ok) {
        const data = await res.json()
        setOverview(data)
      } else {
        setError('Errore nel caricamento dei dati Brain')
      }
    } catch (err) {
      setError('Brain non disponibile: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const runBrainCycle = async () => {
    setRunningBrain(true)
    try {
      await authFetch(`${API_URL}/api/brain/run`, { method: 'POST' })
      // Aspetta qualche secondo poi aggiorna
      setTimeout(() => {
        fetchOverview()
        setRunningBrain(false)
      }, 5000)
    } catch (err) {
      setRunningBrain(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Brain className="w-12 h-12 text-purple-500 animate-pulse mx-auto mb-3" />
          <p className="text-gray-500">Caricamento Brain AI...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error}</p>
        <button onClick={fetchOverview} className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
          Riprova
        </button>
      </div>
    )
  }

  const scoring = overview?.scoring || {}
  const atRisk = overview?.atRiskClients || []
  const allScores = overview?.allScores || []
  const recentActions = overview?.recentActions || []
  const signals = overview?.signals || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Brain AI</h2>
              <p className="text-gray-500 text-sm">Intelligenza artificiale per la tua palestra</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOverview}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            title="Aggiorna dati"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={runBrainCycle}
            disabled={runningBrain}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              runningBrain
                ? 'bg-purple-100 text-purple-400 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            <Zap className={`w-4 h-4 ${runningBrain ? 'animate-pulse' : ''}`} />
            {runningBrain ? 'Analizzando...' : 'Analizza Ora'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'Panoramica', icon: Activity },
            { id: 'clients', label: 'Clienti', icon: Users },
            { id: 'actions', label: 'Azioni AI', icon: Zap }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <OverviewTab scoring={scoring} atRisk={atRisk} signals={signals} recentActions={recentActions} />
      )}
      {activeTab === 'clients' && (
        <ClientsTab allScores={allScores} expandedClient={expandedClient} setExpandedClient={setExpandedClient} />
      )}
      {activeTab === 'actions' && (
        <ActionsTab recentActions={recentActions} />
      )}
    </div>
  )
}

// ==========================================
// TAB: Panoramica
// ==========================================
function OverviewTab({ scoring, atRisk, signals, recentActions }) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Clienti Analizzati"
          value={scoring.total_clients || 0}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Rischio Alto"
          value={scoring.high_risk || 0}
          icon={AlertTriangle}
          color="red"
          subtitle={scoring.total_clients > 0 ? `${Math.round((scoring.high_risk / scoring.total_clients) * 100)}%` : '0%'}
        />
        <StatCard
          label="Molto Coinvolti"
          value={scoring.highly_engaged || 0}
          icon={Heart}
          color="green"
        />
        <StatCard
          label="Trend in Calo"
          value={scoring.trending_down || 0}
          icon={TrendingDown}
          color="orange"
        />
      </div>

      {/* Second row stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Media Churn Risk"
          value={scoring.avg_churn_risk ? `${Math.round(scoring.avg_churn_risk * 100)}%` : 'N/A'}
          icon={Target}
          color="purple"
        />
        <StatCard
          label="Media Engagement"
          value={scoring.avg_engagement ? `${Math.round(scoring.avg_engagement * 100)}%` : 'N/A'}
          icon={Activity}
          color="blue"
        />
        <StatCard
          label="Check-in/Settimana"
          value={scoring.avg_weekly_checkins || '0'}
          icon={Clock}
          color="green"
        />
        <StatCard
          label="Motivazione Alta"
          value={scoring.motivation_high || 0}
          icon={Smile}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clienti a Rischio */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-5 border-b border-gray-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-gray-900">Clienti a Rischio</h3>
            <span className="ml-auto text-sm text-gray-400">{atRisk.length}</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {atRisk.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <Smile className="w-8 h-8 mx-auto mb-2" />
                <p>Nessun cliente a rischio!</p>
              </div>
            ) : (
              atRisk.map((client, i) => (
                <div key={i} className="p-4 hover:bg-red-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{client.name || client.phone}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{client.fitness_goals || 'Obiettivi non specificati'}</p>
                    </div>
                    <div className="text-right">
                      <RiskBadge risk={parseFloat(client.churn_risk)} />
                      <p className="text-xs text-gray-400 mt-1">
                        {client.days_since_last_checkin}gg inattivo
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Azioni Recenti */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-5 border-b border-gray-200 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-gray-900">Azioni AI Recenti</h3>
            <span className="ml-auto text-sm text-gray-400">{recentActions.length}</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {recentActions.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <Brain className="w-8 h-8 mx-auto mb-2" />
                <p>Nessuna azione ancora. Clicca "Analizza Ora"!</p>
              </div>
            ) : (
              recentActions.slice(0, 10).map((action, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <ActionIcon type={action.action_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {action.name || action.phone}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{action.message_content?.substring(0, 80)}...</p>
                      <div className="flex items-center gap-2 mt-1">
                        <ActionTypeBadge type={action.action_type} />
                        <StatusBadge status={action.status} />
                        <span className="text-xs text-gray-400">
                          {formatTimeAgo(action.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Segnali Conversazione */}
      {signals.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            Segnali dalle Conversazioni (ultimi 30gg)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {signals.map((signal, i) => (
              <div key={i} className={`rounded-lg p-3 text-center ${getSignalColor(signal.signal_type)}`}>
                <SignalIcon type={signal.signal_type} />
                <p className="text-lg font-bold mt-1">{signal.count}</p>
                <p className="text-xs capitalize">{signal.signal_type}</p>
                <p className="text-xs opacity-70">{signal.unique_clients} clienti</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// TAB: Clienti
// ==========================================
function ClientsTab({ allScores, expandedClient, setExpandedClient }) {
  const [sortBy, setSortBy] = useState('churn_risk')
  const [sortDir, setSortDir] = useState('desc')

  const sorted = [...allScores].sort((a, b) => {
    const valA = parseFloat(a[sortBy]) || 0
    const valB = parseFloat(b[sortBy]) || 0
    return sortDir === 'desc' ? valB - valA : valA - valB
  })

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  const SortHeader = ({ field, label }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
      </div>
    </th>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <SortHeader field="churn_risk" label="Rischio" />
              <SortHeader field="engagement_score" label="Engagement" />
              <SortHeader field="consistency_score" label="Costanza" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivazione</th>
              <SortHeader field="avg_checkins_per_week" label="Check/Sett" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trend</th>
              <SortHeader field="days_since_last_checkin" label="Ultimo" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((client, i) => (
              <React.Fragment key={i}>
                <tr
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setExpandedClient(expandedClient === client.phone ? null : client.phone)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{client.name || 'N/A'}</p>
                    <p className="text-xs text-gray-400">{client.phone}</p>
                  </td>
                  <td className="px-4 py-3"><RiskBadge risk={parseFloat(client.churn_risk)} /></td>
                  <td className="px-4 py-3"><ScoreBadge score={parseFloat(client.engagement_score)} /></td>
                  <td className="px-4 py-3"><ScoreBadge score={parseFloat(client.consistency_score)} /></td>
                  <td className="px-4 py-3"><MotivationBadge level={client.motivation_level} /></td>
                  <td className="px-4 py-3 text-sm text-gray-700">{client.avg_checkins_per_week || 0}</td>
                  <td className="px-4 py-3"><TrendBadge trend={client.checkin_trend} /></td>
                  <td className="px-4 py-3 text-sm text-gray-700">{client.days_since_last_checkin || 0}gg</td>
                </tr>
                {expandedClient === client.phone && (
                  <tr>
                    <td colSpan={8} className="bg-purple-50 px-6 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Obiettivi</p>
                          <p className="font-medium">{client.fitness_goals || 'Non specificati'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Livello</p>
                          <p className="font-medium">{client.fitness_level || 'Non specificato'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Giorni preferiti</p>
                          <p className="font-medium">{(client.preferred_days || []).map(d => d.substring(0,3)).join(', ') || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Orario preferito</p>
                          <p className="font-medium">{client.preferred_time || 'N/A'}</p>
                        </div>
                        {client.weekly_checkins_history && (
                          <div className="col-span-2">
                            <p className="text-gray-500 text-xs mb-1">Check-in ultime 4 settimane</p>
                            <div className="flex gap-1 items-end h-8">
                              {(() => {
                                try {
                                  const data = typeof client.weekly_checkins_history === 'string'
                                    ? JSON.parse(client.weekly_checkins_history)
                                    : client.weekly_checkins_history;
                                  return Array.isArray(data) ? data : [];
                                } catch { return []; }
                              })().map((count, wi) => (
                                <div
                                  key={wi}
                                  className="bg-purple-400 rounded-sm flex-1"
                                  style={{ height: `${Math.max(4, (count / 7) * 100)}%` }}
                                  title={`Settimana ${wi + 1}: ${count} check-in`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  <Brain className="w-8 h-8 mx-auto mb-2" />
                  <p>Nessun dato. Clicca "Analizza Ora" per avviare il Brain.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==========================================
// TAB: Azioni AI
// ==========================================
function ActionsTab({ recentActions }) {
  return (
    <div className="space-y-4">
      {recentActions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nessuna azione ancora.</p>
          <p className="text-sm text-gray-400 mt-1">Il Brain inviera messaggi personalizzati ai clienti che ne hanno bisogno.</p>
        </div>
      ) : (
        recentActions.map((action, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              <ActionIcon type={action.action_type} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900">{action.name || action.phone}</p>
                  <ActionTypeBadge type={action.action_type} />
                  <StatusBadge status={action.status} />
                </div>
                <p className="text-gray-600 text-sm mb-2">{action.message_content}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>Motivo: {action.reason}</span>
                  <span>{formatTimeAgo(action.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ==========================================
// Helper Components
// ==========================================

function StatCard({ label, value, icon: Icon, color, subtitle }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

function RiskBadge({ risk }) {
  const pct = Math.round(risk * 100)
  let color = 'bg-green-100 text-green-700'
  if (pct >= 70) color = 'bg-red-100 text-red-700'
  else if (pct >= 50) color = 'bg-orange-100 text-orange-700'
  else if (pct >= 30) color = 'bg-yellow-100 text-yellow-700'
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{pct}%</span>
}

function ScoreBadge({ score }) {
  const pct = Math.round(score * 100)
  let color = 'bg-red-100 text-red-700'
  if (pct >= 70) color = 'bg-green-100 text-green-700'
  else if (pct >= 40) color = 'bg-yellow-100 text-yellow-700'
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{pct}%</span>
}

function MotivationBadge({ level }) {
  const config = {
    high: { color: 'bg-green-100 text-green-700', icon: Smile, label: 'Alta' },
    medium: { color: 'bg-gray-100 text-gray-700', icon: Minus, label: 'Media' },
    low: { color: 'bg-red-100 text-red-700', icon: Frown, label: 'Bassa' }
  }
  const c = config[level] || config.medium
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      <c.icon className="w-3 h-3" />
      {c.label}
    </span>
  )
}

function TrendBadge({ trend }) {
  const config = {
    up: { color: 'text-green-600', icon: ArrowUp, label: 'In salita' },
    stable: { color: 'text-gray-500', icon: Minus, label: 'Stabile' },
    down: { color: 'text-red-600', icon: ArrowDown, label: 'In calo' }
  }
  const c = config[trend] || config.stable
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.color}`}>
      <c.icon className="w-3 h-3" />
      {c.label}
    </span>
  )
}

function ActionIcon({ type, size = 'sm' }) {
  const sizeClass = size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'
  const iconSize = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
  const config = {
    comeback_message: { bg: 'bg-red-100', color: 'text-red-600', icon: Heart },
    personalized_motivation: { bg: 'bg-orange-100', color: 'text-orange-600', icon: Zap },
    check_progress: { bg: 'bg-blue-100', color: 'text-blue-600', icon: Target },
    gentle_reminder: { bg: 'bg-yellow-100', color: 'text-yellow-600', icon: Clock },
    streak_recovery: { bg: 'bg-purple-100', color: 'text-purple-600', icon: TrendingUp },
    scheda_adjust: { bg: 'bg-green-100', color: 'text-green-600', icon: Activity },
    celebration: { bg: 'bg-pink-100', color: 'text-pink-600', icon: Star }
  }
  const c = config[type] || config.personalized_motivation
  return (
    <div className={`${sizeClass} ${c.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
      <c.icon className={`${iconSize} ${c.color}`} />
    </div>
  )
}

function ActionTypeBadge({ type }) {
  const labels = {
    comeback_message: 'Ritorno',
    personalized_motivation: 'Motivazione',
    check_progress: 'Progresso',
    gentle_reminder: 'Reminder',
    streak_recovery: 'Streak',
    scheda_adjust: 'Scheda',
    celebration: 'Celebrazione'
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
      {labels[type] || type}
    </span>
  )
}

function StatusBadge({ status }) {
  const config = {
    sent: { color: 'bg-green-100 text-green-700', label: 'Inviato' },
    pending: { color: 'bg-yellow-100 text-yellow-700', label: 'In attesa' },
    failed: { color: 'bg-red-100 text-red-700', label: 'Fallito' },
    skipped: { color: 'bg-gray-100 text-gray-700', label: 'Saltato' }
  }
  const c = config[status] || config.pending
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span>
}

function SignalIcon({ type }) {
  const icons = {
    frustration: Frown,
    motivation: Smile,
    barrier: AlertTriangle,
    progress: TrendingUp,
    pain: Heart,
    celebration: Star
  }
  const Icon = icons[type] || Activity
  return <Icon className="w-5 h-5 mx-auto" />
}

function getSignalColor(type) {
  const colors = {
    frustration: 'bg-red-50 text-red-700',
    motivation: 'bg-green-50 text-green-700',
    barrier: 'bg-orange-50 text-orange-700',
    progress: 'bg-blue-50 text-blue-700',
    pain: 'bg-pink-50 text-pink-700',
    celebration: 'bg-purple-50 text-purple-700'
  }
  return colors[type] || 'bg-gray-50 text-gray-700'
}

function formatTimeAgo(date) {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Ora'
  if (minutes < 60) return `${minutes}m fa`
  if (hours < 24) return `${hours}h fa`
  if (days < 7) return `${days}gg fa`
  return d.toLocaleDateString('it-IT')
}
