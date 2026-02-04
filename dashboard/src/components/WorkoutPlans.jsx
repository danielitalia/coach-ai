import React, { useState, useEffect } from 'react'
import {
  Dumbbell, Plus, Download, Send, Trash2, User, Target,
  Calendar, Clock, ChevronDown, ChevronUp, Search, Filter,
  FileText, CheckCircle, AlertCircle, X
} from 'lucide-react'

const API_URL = ''

function WorkoutPlans() {
  const [plans, setPlans] = useState([])
  const [clients, setClients] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedPlan, setExpandedPlan] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterObjective, setFilterObjective] = useState('')
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchPlans()
    fetchClients()
    fetchStats()
  }, [])

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_URL}/api/workouts`)
      if (res.ok) {
        const data = await res.json()
        setPlans(data)
      }
    } catch (err) {
      console.log('Errore fetch schede:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      const res = await fetch(`${API_URL}/api/clients`)
      if (res.ok) {
        const data = await res.json()
        setClients(data)
      }
    } catch (err) {
      console.log('Errore fetch clienti:', err)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/workouts-stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.log('Errore fetch stats:', err)
    }
  }

  const downloadPDF = async (plan) => {
    try {
      window.open(`${API_URL}/api/workouts/${plan.phone}/${plan.id}/pdf`, '_blank')
      showMessage('success', 'Download PDF avviato')
    } catch (err) {
      showMessage('error', 'Errore download PDF')
    }
  }

  const sendToWhatsApp = async (plan) => {
    try {
      const res = await fetch(`${API_URL}/api/workouts/${plan.phone}/${plan.id}/send`, {
        method: 'POST'
      })
      if (res.ok) {
        showMessage('success', 'Scheda inviata via WhatsApp!')
      } else {
        showMessage('error', 'Errore invio WhatsApp')
      }
    } catch (err) {
      showMessage('error', 'Errore invio WhatsApp')
    }
  }

  const deletePlan = async (plan) => {
    if (!confirm('Sei sicuro di voler eliminare questa scheda?')) return

    try {
      const res = await fetch(`${API_URL}/api/workouts/${plan.phone}/${plan.id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchPlans()
        showMessage('success', 'Scheda eliminata')
      }
    } catch (err) {
      showMessage('error', 'Errore eliminazione')
    }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const filteredPlans = plans.filter(plan => {
    const matchesSearch = plan.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plan.phone.includes(searchTerm)
    const matchesObjective = !filterObjective || plan.objective === filterObjective
    return matchesSearch && matchesObjective
  })

  const objectiveColors = {
    dimagrire: 'bg-orange-100 text-orange-700',
    massa: 'bg-blue-100 text-blue-700',
    tonificare: 'bg-purple-100 text-purple-700',
    salute: 'bg-green-100 text-green-700'
  }

  const objectiveLabels = {
    dimagrire: 'Dimagrire',
    massa: 'Massa',
    tonificare: 'Tonificare',
    salute: 'Salute'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Schede Allenamento</h2>
          <p className="text-gray-500 mt-1">Genera e gestisci le schede personalizzate</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuova Scheda
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-2xl font-bold text-gray-900">{stats.totalPlans}</p>
            <p className="text-sm text-gray-500">Schede totali</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-2xl font-bold text-gray-900">{stats.clientsWithPlans}</p>
            <p className="text-sm text-gray-500">Clienti con scheda</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-2xl font-bold text-blue-600">{stats.byObjective?.massa || 0}</p>
            <p className="text-sm text-gray-500">Schede Massa</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-2xl font-bold text-orange-600">{stats.byObjective?.dimagrire || 0}</p>
            <p className="text-sm text-gray-500">Schede Dimagrire</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filterObjective}
          onChange={(e) => setFilterObjective(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Tutti gli obiettivi</option>
          <option value="dimagrire">Dimagrire</option>
          <option value="massa">Massa muscolare</option>
          <option value="tonificare">Tonificare</option>
          <option value="salute">Salute generale</option>
        </select>
      </div>

      {/* Plans List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Caricamento...</div>
        ) : filteredPlans.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Dumbbell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">Nessuna scheda trovata</p>
            <p className="text-sm text-gray-400 mt-1">Crea una nuova scheda per iniziare</p>
          </div>
        ) : (
          filteredPlans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Plan Header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <Dumbbell className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{plan.clientName}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${objectiveColors[plan.objective]}`}>
                        {objectiveLabels[plan.objective]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {plan.daysPerWeek} giorni/sett
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(plan.createdAt).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadPDF(plan); }}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                    title="Scarica PDF"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); sendToWhatsApp(plan); }}
                    className="p-2 hover:bg-green-50 rounded-lg text-green-600 hover:text-green-700"
                    title="Invia su WhatsApp"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePlan(plan); }}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-500 hover:text-red-600"
                    title="Elimina"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  {expandedPlan === plan.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedPlan === plan.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plan.workouts.map((workout, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200">
                        <h4 className="font-semibold text-primary-600 mb-3">{workout.day}</h4>
                        <div className="space-y-2">
                          {workout.exercises.map((ex, exIdx) => (
                            <div key={exIdx} className="text-sm">
                              <p className="font-medium text-gray-800">{ex.name}</p>
                              <p className="text-gray-500">{ex.sets}x{ex.reps} - Pausa: {ex.rest}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700"><strong>Note:</strong> {plan.notes}</p>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateWorkoutModal
          clients={clients}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            fetchPlans()
            fetchStats()
            setShowCreateModal(false)
            showMessage('success', 'Scheda creata con successo!')
          }}
        />
      )}
    </div>
  )
}

function CreateWorkoutModal({ clients, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    objective: 'tonificare',
    experience: 'intermedio',
    daysPerWeek: 3,
    limitations: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/workouts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        onCreated()
      } else {
        const data = await res.json()
        setError(data.error || 'Errore creazione scheda')
      }
    } catch (err) {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  const handleClientSelect = (phone) => {
    const client = clients.find(c => c.phone === phone)
    setFormData({
      ...formData,
      phone,
      name: client?.name || ''
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Crea Nuova Scheda</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            {clients.length > 0 ? (
              <select
                value={formData.phone}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">Seleziona cliente...</option>
                {clients.map(client => (
                  <option key={client.phone} value={client.phone}>
                    {client.name || `Cliente ${client.phone.slice(-4)}`} (+{client.phone})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Numero telefono (es. 393331234567)"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            )}
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome cliente</label>
            <input
              type="text"
              placeholder="Nome del cliente"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Obiettivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Obiettivo</label>
            <select
              value={formData.objective}
              onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="dimagrire">Dimagrire</option>
              <option value="massa">Massa muscolare</option>
              <option value="tonificare">Tonificare</option>
              <option value="salute">Salute generale</option>
            </select>
          </div>

          {/* Esperienza */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Livello esperienza</label>
            <select
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="principiante">Principiante</option>
              <option value="intermedio">Intermedio</option>
              <option value="esperto">Esperto</option>
            </select>
          </div>

          {/* Giorni */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giorni alla settimana</label>
            <select
              value={formData.daysPerWeek}
              onChange={(e) => setFormData({ ...formData, daysPerWeek: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={2}>2 giorni</option>
              <option value={3}>3 giorni</option>
              <option value={4}>4 giorni</option>
              <option value={5}>5 giorni</option>
            </select>
          </div>

          {/* Limitazioni */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Limitazioni fisiche</label>
            <textarea
              placeholder="Es. problemi alla schiena, ginocchio..."
              value={formData.limitations}
              onChange={(e) => setFormData({ ...formData, limitations: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !formData.phone}
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>Generazione...</>
              ) : (
                <>
                  <Dumbbell className="w-4 h-4" />
                  Genera Scheda
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default WorkoutPlans
