import React, { useState, useEffect } from 'react'
import { Search, Phone, MessageSquare, UserPlus, X, AlertTriangle, Dumbbell, Clock, Filter, ChevronDown, Send, TrendingDown, TrendingUp, Minus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || ''

function ClientList() {
  const { authFetch } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterChurn, setFilterChurn] = useState('all')
  const [filterWorkout, setFilterWorkout] = useState('all')
  const [filterActivity, setFilterActivity] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newClient, setNewClient] = useState({
    phone: '',
    name: '',
    objective: '',
    experience: '',
    daysPerWeek: 3
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingClients, setLoadingClients] = useState(true)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    setLoadingClients(true)
    try {
      const res = await authFetch(`${API_URL}/api/clients`)
      if (res.ok) {
        const data = await res.json()
        setClients(data)
      }
    } catch (err) {
      console.error('Errore caricamento clienti:', err)
    } finally {
      setLoadingClients(false)
    }
  }

  const handleCreateClient = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      let phone = newClient.phone.replace(/\s+/g, '').replace(/^\+/, '')
      if (phone.startsWith('00')) phone = phone.substring(2)

      // Auto-aggiungi 39 solo se sembra un cellulare italiano senza prefisso (10 cifre, inizia con 3)
      if (phone.length === 10 && phone.startsWith('3')) {
        phone = '39' + phone
      }

      const res = await authFetch(`${API_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newClient,
          phone
        })
      })

      if (res.ok) {
        setShowModal(false)
        setNewClient({ phone: '', name: '', objective: '', experience: '', daysPerWeek: 3 })
        fetchClients()
      } else {
        const data = await res.json()
        setError(data.error || 'Errore creazione cliente')
      }
    } catch (err) {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  // Churn risk level
  const getChurnLevel = (risk) => {
    if (risk === null || risk === undefined) return 'unknown'
    if (risk >= 0.7) return 'high'
    if (risk >= 0.4) return 'medium'
    return 'low'
  }

  // Filter logic
  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone?.includes(searchTerm)

    const churnLevel = getChurnLevel(client.churnRisk)
    const matchesChurn = filterChurn === 'all' || churnLevel === filterChurn

    const hasWorkout = !!client.latestWorkoutId
    const matchesWorkout = filterWorkout === 'all' ||
      (filterWorkout === 'with' && hasWorkout) ||
      (filterWorkout === 'without' && !hasWorkout)

    const matchesActivity = filterActivity === 'all' ||
      (filterActivity === 'active' && client.status === 'active') ||
      (filterActivity === 'inactive' && client.status !== 'active')

    return matchesSearch && matchesChurn && matchesWorkout && matchesActivity
  })

  const activeFiltersCount = [filterChurn, filterWorkout, filterActivity].filter(f => f !== 'all').length

  // Stats
  const highChurnCount = clients.filter(c => getChurnLevel(c.churnRisk) === 'high').length
  const noWorkoutCount = clients.filter(c => !c.latestWorkoutId).length
  const inactiveCount = clients.filter(c => c.status !== 'active').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clienti</h2>
          <p className="text-gray-500">{clients.length} clienti totali</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          <span>Nuovo Cliente</span>
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => { setFilterChurn(filterChurn === 'high' ? 'all' : 'high'); setShowFilters(true) }}
          className={`p-3 rounded-xl border text-left transition-all ${filterChurn === 'high' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-gray-500 uppercase">Rischio Alto</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{highChurnCount}</p>
        </button>
        <button
          onClick={() => { setFilterWorkout(filterWorkout === 'without' ? 'all' : 'without'); setShowFilters(true) }}
          className={`p-3 rounded-xl border text-left transition-all ${filterWorkout === 'without' ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-200'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Dumbbell className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-gray-500 uppercase">Senza Scheda</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{noWorkoutCount}</p>
        </button>
        <button
          onClick={() => { setFilterActivity(filterActivity === 'inactive' ? 'all' : 'inactive'); setShowFilters(true) }}
          className={`p-3 rounded-xl border text-left transition-all ${filterActivity === 'inactive' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-500 uppercase">Inattivi</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{inactiveCount}</p>
        </button>
      </div>

      {/* Search + Filter Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca per nome o telefono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${activeFiltersCount > 0 ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filtri</span>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center">{activeFiltersCount}</span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Rischio Churn</label>
              <select
                value={filterChurn}
                onChange={(e) => setFilterChurn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">Tutti</option>
                <option value="high">Alto (≥70%)</option>
                <option value="medium">Medio (40-70%)</option>
                <option value="low">Basso (&lt;40%)</option>
                <option value="unknown">Non calcolato</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Scheda Allenamento</label>
              <select
                value={filterWorkout}
                onChange={(e) => setFilterWorkout(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">Tutti</option>
                <option value="with">Con scheda</option>
                <option value="without">Senza scheda</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Attività</label>
              <select
                value={filterActivity}
                onChange={(e) => setFilterActivity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">Tutti</option>
                <option value="active">Attivi (ultimi 7gg)</option>
                <option value="inactive">Inattivi</option>
              </select>
            </div>
          </div>
          {activeFiltersCount > 0 && (
            <button
              onClick={() => { setFilterChurn('all'); setFilterWorkout('all'); setFilterActivity('all') }}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Resetta filtri
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      {(searchTerm || activeFiltersCount > 0) && (
        <p className="text-sm text-gray-500">
          {filteredClients.length} risultat{filteredClients.length === 1 ? 'o' : 'i'} su {clients.length}
        </p>
      )}

      {/* Loading */}
      {loadingClients && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">Caricamento clienti...</p>
        </div>
      )}

      {/* Client Cards */}
      {!loadingClients && (
        <div className="grid gap-3">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.phone}
              client={client}
              getChurnLevel={getChurnLevel}
              navigate={navigate}
              authFetch={authFetch}
              onDeleted={fetchClients}
            />
          ))}
        </div>
      )}

      {!loadingClients && filteredClients.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mt-6">
          <UserPlus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 font-medium">Nessun cliente trovato</p>
          <p className="text-sm text-gray-400 mt-1">Clicca su "Nuovo Cliente" per aggiungerne uno</p>
        </div>
      )}

      {/* Modal Nuovo Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Nuovo Cliente</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numero WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="es. 393331234567 o +447700900000"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">Prefisso internazionale obbligatorio (es. 39 per Italia)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Mario Rossi"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Obiettivo
                </label>
                <select
                  value={newClient.objective}
                  onChange={(e) => setNewClient({ ...newClient, objective: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleziona...</option>
                  <option value="Dimagrire">Dimagrire</option>
                  <option value="Massa muscolare">Massa muscolare</option>
                  <option value="Tonificare">Tonificare</option>
                  <option value="Salute generale">Salute generale</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Esperienza
                </label>
                <select
                  value={newClient.experience}
                  onChange={(e) => setNewClient({ ...newClient, experience: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleziona...</option>
                  <option value="Principiante">Principiante</option>
                  <option value="Intermedio">Intermedio</option>
                  <option value="Esperto">Esperto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Giorni/Settimana
                </label>
                <select
                  value={newClient.daysPerWeek}
                  onChange={(e) => setNewClient({ ...newClient, daysPerWeek: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={2}>2 giorni</option>
                  <option value={3}>3 giorni</option>
                  <option value={4}>4 giorni</option>
                  <option value={5}>5 giorni</option>
                  <option value={6}>6 giorni</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  {loading ? 'Creazione...' : 'Crea Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ClientCard({ client, getChurnLevel, navigate, authFetch, onDeleted }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm(`Sei sicuro di voler eliminare ${client.name || client.phone}? Tutti i dati (messaggi, check-in, schede) verranno cancellati.`)) return
    setDeleting(true)
    try {
      const res = await authFetch(`${API_URL}/api/clients/${client.phone}`, { method: 'DELETE' })
      if (res.ok) {
        onDeleted()
        toast.success('Cliente eliminato con successo')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Errore durante l\'eliminazione')
      }
    } catch (err) {
      toast.error('Errore di connessione')
    } finally {
      setDeleting(false)
    }
  }
  const churnLevel = getChurnLevel(client.churnRisk)

  const churnConfig = {
    high: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Rischio Alto', dot: 'bg-red-500' },
    medium: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Rischio Medio', dot: 'bg-yellow-500' },
    low: { color: 'bg-green-100 text-green-700 border-green-200', label: 'Basso Rischio', dot: 'bg-green-500' },
    unknown: { color: 'bg-gray-100 text-gray-500 border-gray-200', label: 'N/D', dot: 'bg-gray-400' }
  }

  const trendIcon = {
    up: <TrendingUp className="w-3.5 h-3.5 text-green-500" />,
    down: <TrendingDown className="w-3.5 h-3.5 text-red-500" />,
    stable: <Minus className="w-3.5 h-3.5 text-gray-400" />
  }

  const churn = churnConfig[churnLevel]
  const hasWorkout = !!client.latestWorkoutId

  return (
    <div className={`bg-white rounded-xl border p-4 sm:p-5 hover:shadow-md transition-shadow ${churnLevel === 'high' ? 'border-red-200' : 'border-gray-200'}`}>
      {/* Top row: avatar + name + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${churnLevel === 'high' ? 'bg-red-100' : 'bg-primary-100'}`}>
            <span className={`font-bold text-lg ${churnLevel === 'high' ? 'text-red-700' : 'text-primary-700'}`}>
              {client.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{client.name || 'Sconosciuto'}</h3>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" />
              +{client.phone}
            </p>
          </div>
        </div>

        {/* Churn badge */}
        <div className={`px-2.5 py-1 text-xs font-medium rounded-full border shrink-0 flex items-center gap-1.5 ${churn.color}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${churn.dot}`} />
          {churn.label}
        </div>
      </div>

      {/* Info row */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3.5 h-3.5" />
          {client.messagesCount} messaggi
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {client.daysSinceLastCheckin !== null && client.daysSinceLastCheckin !== undefined
            ? (client.daysSinceLastCheckin === 0 ? 'Check-in oggi' : `${client.daysSinceLastCheckin}gg fa`)
            : 'Mai fatto check-in'
          }
          {client.checkinTrend && trendIcon[client.checkinTrend]}
        </span>
        <span className="flex items-center gap-1">
          <Dumbbell className="w-3.5 h-3.5" />
          {hasWorkout ? `Scheda del ${formatDateShort(client.latestWorkoutDate)}` : 'Nessuna scheda'}
        </span>
        {client.objective && (
          <span className="text-gray-400">
            {client.objective} · {client.experience || '?'}
          </span>
        )}
      </div>

      {/* Actions row */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
        <button
          onClick={() => navigate('/conversations')}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-medium transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          Messaggio
        </button>
        <button
          onClick={() => navigate('/workouts')}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg text-xs font-medium transition-colors"
        >
          <Dumbbell className="w-3.5 h-3.5" />
          {hasWorkout ? 'Vedi Scheda' : 'Genera Scheda'}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function formatDateShort(date) {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
}

export default ClientList
