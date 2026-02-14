import React, { useState, useEffect } from 'react'
import {
  BarChart3, TrendingUp, Users, MessageSquare, Calendar,
  Activity, Target, Loader2, RefreshCw, ChevronDown,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://coachpalestra.it'

function Analytics() {
  const [summary, setSummary] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState(30) // giorni
  const [backfilling, setBackfilling] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      const [summaryRes, timelineRes] = await Promise.all([
        fetch(`${API_BASE}/api/analytics/summary?days=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/analytics/timeline?days=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (!summaryRes.ok || !timelineRes.ok) throw new Error('Errore caricamento dati')

      const summaryData = await summaryRes.json()
      const timelineData = await timelineRes.json()

      setSummary(summaryData)
      setTimeline(timelineData)
      setError(null)
    } catch (err) {
      console.error('Errore fetch analytics:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [period])

  const handleBackfill = async () => {
    if (!confirm(`Vuoi ricalcolare le statistiche degli ultimi ${period} giorni?`)) return

    setBackfilling(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/analytics/backfill`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ days: period })
      })

      if (!res.ok) throw new Error('Errore backfill')

      await fetchData()
      alert('Statistiche ricalcolate con successo!')
    } catch (err) {
      alert('Errore durante il ricalcolo: ' + err.message)
    } finally {
      setBackfilling(false)
    }
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num?.toString() || '0'
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  }

  const getTrend = (current, previous) => {
    if (!previous || previous === 0) return { value: 0, direction: 'neutral' }
    const change = ((current - previous) / previous) * 100
    return {
      value: Math.abs(change).toFixed(1),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    }
  }

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6']

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Riprova
        </button>
      </div>
    )
  }

  // Prepara dati per i grafici
  const chartData = timeline.map(day => ({
    date: formatDate(day.date),
    fullDate: day.date,
    messaggi: (day.messages_sent || 0) + (day.messages_received || 0),
    inviati: day.messages_sent || 0,
    ricevuti: day.messages_received || 0,
    checkin: day.checkins || 0,
    clientiAttivi: day.active_clients || 0,
    nuoviClienti: day.new_clients || 0,
    automazioni: day.automation_messages_sent || 0
  }))

  // Calcola totali per periodo precedente (per confronto)
  const midPoint = Math.floor(chartData.length / 2)
  const firstHalf = chartData.slice(0, midPoint)
  const secondHalf = chartData.slice(midPoint)

  const sumField = (arr, field) => arr.reduce((sum, item) => sum + (item[field] || 0), 0)

  const trends = {
    messaggi: getTrend(sumField(secondHalf, 'messaggi'), sumField(firstHalf, 'messaggi')),
    checkin: getTrend(sumField(secondHalf, 'checkin'), sumField(firstHalf, 'checkin')),
    nuoviClienti: getTrend(sumField(secondHalf, 'nuoviClienti'), sumField(firstHalf, 'nuoviClienti'))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-green-500" />
            Analytics
          </h1>
          <p className="text-gray-600 mt-1">Monitora le performance della tua palestra</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(parseInt(e.target.value))}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value={7}>Ultimi 7 giorni</option>
              <option value={14}>Ultimi 14 giorni</option>
              <option value={30}>Ultimi 30 giorni</option>
              <option value={90}>Ultimi 90 giorni</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            title="Ricalcola statistiche dai dati storici"
          >
            <RefreshCw className={`w-4 h-4 ${backfilling ? 'animate-spin' : ''}`} />
            {backfilling ? 'Elaborazione...' : 'Ricalcola'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Messaggi Totali"
          value={formatNumber((summary?.total_messages_sent || 0) + (summary?.total_messages_received || 0))}
          subtitle={`${formatNumber(summary?.total_messages_sent || 0)} inviati, ${formatNumber(summary?.total_messages_received || 0)} ricevuti`}
          icon={MessageSquare}
          color="blue"
          trend={trends.messaggi}
        />
        <KPICard
          title="Check-in"
          value={formatNumber(summary?.total_checkins || 0)}
          subtitle={`Media: ${summary?.avg_daily_checkins || 0}/giorno`}
          icon={Calendar}
          color="green"
          trend={trends.checkin}
        />
        <KPICard
          title="Nuovi Clienti"
          value={formatNumber(summary?.total_new_clients || 0)}
          subtitle={`Nel periodo selezionato`}
          icon={Users}
          color="purple"
          trend={trends.nuoviClienti}
        />
        <KPICard
          title="Automazioni"
          value={formatNumber(summary?.total_automation_messages || 0)}
          subtitle={`${formatNumber(summary?.total_automation_conversions || 0)} conversioni`}
          icon={Target}
          color="orange"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            Messaggi nel Tempo
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  labelFormatter={(label) => `Data: ${label}`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="inviati"
                  name="Inviati"
                  stackId="1"
                  stroke="#3B82F6"
                  fill="#93C5FD"
                />
                <Area
                  type="monotone"
                  dataKey="ricevuti"
                  name="Ricevuti"
                  stackId="1"
                  stroke="#10B981"
                  fill="#6EE7B7"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Check-ins Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-500" />
            Check-in Giornalieri
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="checkin" name="Check-in" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Clients Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-500" />
            Clienti Attivi
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Line
                  type="monotone"
                  dataKey="clientiAttivi"
                  name="Clienti Attivi"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  dot={{ fill: '#8B5CF6', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="nuoviClienti"
                  name="Nuovi Clienti"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ fill: '#F59E0B', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Automation Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-500" />
            Messaggi Automazioni
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Area
                  type="monotone"
                  dataKey="automazioni"
                  name="Automazioni"
                  stroke="#F59E0B"
                  fill="#FDE68A"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats Info */}
      {summary?.days_with_data < period && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
          <strong>Nota:</strong> Sono disponibili dati per {summary.days_with_data} giorni sui {period} selezionati.
          Clicca "Ricalcola" per generare le statistiche mancanti dai dati storici.
        </div>
      )}
    </div>
  )
}

// KPI Card Component
function KPICard({ title, value, subtitle, icon: Icon, color, trend }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600'
  }

  const TrendIcon = trend?.direction === 'up' ? ArrowUpRight :
                    trend?.direction === 'down' ? ArrowDownRight : Minus

  const trendColor = trend?.direction === 'up' ? 'text-green-500' :
                     trend?.direction === 'down' ? 'text-red-500' : 'text-gray-400'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
      <h3 className="text-sm text-gray-500 font-medium">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  )
}

export default Analytics
