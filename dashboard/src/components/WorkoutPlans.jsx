import React, { useState, useEffect } from 'react'
import {
  Dumbbell, Plus, Download, Send, Trash2, User, Target,
  Calendar, Clock, ChevronDown, ChevronUp, Search, Filter,
  FileText, CheckCircle, AlertCircle, X, Edit3, Save, PlusCircle, MinusCircle,
  MessageCircle
} from 'lucide-react'

const API_URL = ''

function WorkoutPlans() {
  const [plans, setPlans] = useState([])
  const [clients, setClients] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messagePlan, setMessagePlan] = useState(null)
  const [editingPlan, setEditingPlan] = useState(null)
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

  const openEditModal = (plan) => {
    setEditingPlan(JSON.parse(JSON.stringify(plan))) // Deep copy
    setShowEditModal(true)
  }

  const openMessageModal = (plan) => {
    setMessagePlan(plan)
    setShowMessageModal(true)
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
            <p className="text-2xl font-bold text-gray-900">{stats.totalPlans || stats.total || 0}</p>
            <p className="text-sm text-gray-500">Schede totali</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-2xl font-bold text-gray-900">{stats.clientsWithPlans || stats.sent || 0}</p>
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
                    onClick={(e) => { e.stopPropagation(); openMessageModal(plan); }}
                    className="p-2 hover:bg-purple-50 rounded-lg text-purple-600 hover:text-purple-700"
                    title="Invia messaggio"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(plan); }}
                    className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 hover:text-blue-700"
                    title="Modifica scheda"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
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
                    title="Invia scheda su WhatsApp"
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
                  {plan.notes && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700"><strong>Note:</strong> {plan.notes}</p>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => openEditModal(plan)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Modifica Scheda
                    </button>
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

      {/* Edit Modal */}
      {showEditModal && editingPlan && (
        <EditWorkoutModal
          plan={editingPlan}
          onClose={() => {
            setShowEditModal(false)
            setEditingPlan(null)
          }}
          onSaved={() => {
            fetchPlans()
            setShowEditModal(false)
            setEditingPlan(null)
            showMessage('success', 'Scheda aggiornata con successo!')
          }}
        />
      )}

      {/* Message Modal */}
      {showMessageModal && messagePlan && (
        <SendMessageModal
          plan={messagePlan}
          onClose={() => {
            setShowMessageModal(false)
            setMessagePlan(null)
          }}
          onSent={() => {
            setShowMessageModal(false)
            setMessagePlan(null)
            showMessage('success', 'Messaggio inviato!')
          }}
        />
      )}
    </div>
  )
}

// ========== EDIT WORKOUT MODAL ==========
function EditWorkoutModal({ plan, onClose, onSaved }) {
  const [editedPlan, setEditedPlan] = useState(plan)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeDay, setActiveDay] = useState(0)

  const handleSave = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/api/workouts/${editedPlan.phone}/${editedPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workouts: editedPlan.workouts,
          notes: editedPlan.notes,
          objective: editedPlan.objective
        })
      })

      if (res.ok) {
        onSaved()
      } else {
        const data = await res.json()
        setError(data.error || 'Errore salvataggio')
      }
    } catch (err) {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  const updateExercise = (dayIndex, exerciseIndex, field, value) => {
    const newWorkouts = [...editedPlan.workouts]
    newWorkouts[dayIndex].exercises[exerciseIndex][field] = value
    setEditedPlan({ ...editedPlan, workouts: newWorkouts })
  }

  const addExercise = (dayIndex) => {
    const newWorkouts = [...editedPlan.workouts]
    newWorkouts[dayIndex].exercises.push({
      name: 'Nuovo esercizio',
      sets: '3',
      reps: '12',
      rest: '60s'
    })
    setEditedPlan({ ...editedPlan, workouts: newWorkouts })
  }

  const removeExercise = (dayIndex, exerciseIndex) => {
    const newWorkouts = [...editedPlan.workouts]
    newWorkouts[dayIndex].exercises.splice(exerciseIndex, 1)
    setEditedPlan({ ...editedPlan, workouts: newWorkouts })
  }

  const addDay = () => {
    const newWorkouts = [...editedPlan.workouts]
    const dayNumber = newWorkouts.length + 1
    newWorkouts.push({
      day: `Giorno ${dayNumber}`,
      exercises: [
        { name: 'Esercizio 1', sets: '3', reps: '12', rest: '60s' }
      ]
    })
    setEditedPlan({ ...editedPlan, workouts: newWorkouts })
    setActiveDay(newWorkouts.length - 1)
  }

  const removeDay = (dayIndex) => {
    if (editedPlan.workouts.length <= 1) return
    const newWorkouts = [...editedPlan.workouts]
    newWorkouts.splice(dayIndex, 1)
    setEditedPlan({ ...editedPlan, workouts: newWorkouts })
    if (activeDay >= newWorkouts.length) {
      setActiveDay(newWorkouts.length - 1)
    }
  }

  const updateDayName = (dayIndex, name) => {
    const newWorkouts = [...editedPlan.workouts]
    newWorkouts[dayIndex].day = name
    setEditedPlan({ ...editedPlan, workouts: newWorkouts })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Modifica Scheda</h3>
            <p className="text-sm text-gray-500 mt-1">{editedPlan.clientName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {/* Days Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {editedPlan.workouts.map((workout, idx) => (
              <button
                key={idx}
                onClick={() => setActiveDay(idx)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeDay === idx
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {workout.day}
              </button>
            ))}
            <button
              onClick={addDay}
              className="px-4 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-1"
            >
              <PlusCircle className="w-4 h-4" />
              Aggiungi Giorno
            </button>
          </div>

          {/* Active Day Editor */}
          {editedPlan.workouts[activeDay] && (
            <div className="space-y-4">
              {/* Day Name */}
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={editedPlan.workouts[activeDay].day}
                  onChange={(e) => updateDayName(activeDay, e.target.value)}
                  className="flex-1 px-4 py-2 text-lg font-semibold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {editedPlan.workouts.length > 1 && (
                  <button
                    onClick={() => removeDay(activeDay)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Rimuovi
                  </button>
                )}
              </div>

              {/* Exercises */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700">Esercizi</h4>
                {editedPlan.workouts[activeDay].exercises.map((exercise, exIdx) => (
                  <div key={exIdx} className="flex gap-3 items-start bg-gray-50 p-4 rounded-lg">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Nome esercizio</label>
                        <input
                          type="text"
                          value={exercise.name}
                          onChange={(e) => updateExercise(activeDay, exIdx, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Serie</label>
                        <input
                          type="text"
                          value={exercise.sets}
                          onChange={(e) => updateExercise(activeDay, exIdx, 'sets', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="3"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Ripetizioni</label>
                        <input
                          type="text"
                          value={exercise.reps}
                          onChange={(e) => updateExercise(activeDay, exIdx, 'reps', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="12"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Recupero</label>
                        <input
                          type="text"
                          value={exercise.rest}
                          onChange={(e) => updateExercise(activeDay, exIdx, 'rest', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="60s"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeExercise(activeDay, exIdx)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Rimuovi esercizio"
                    >
                      <MinusCircle className="w-5 h-5" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => addExercise(activeDay)}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-500 flex items-center justify-center gap-2 transition-colors"
                >
                  <PlusCircle className="w-5 h-5" />
                  Aggiungi Esercizio
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Note generali</label>
            <textarea
              value={editedPlan.notes || ''}
              onChange={(e) => setEditedPlan({ ...editedPlan, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Note per il cliente..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              'Salvataggio...'
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salva Modifiche
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ========== SEND MESSAGE MODAL ==========
function SendMessageModal({ plan, onClose, onSent }) {
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const quickMessages = [
    "Ciao! Ho aggiornato la tua scheda di allenamento. Dai un'occhiata!",
    "Complimenti per i tuoi progressi! Continua così!",
    "Ricorda di idratarti bene durante l'allenamento!",
    "Come sta andando con la nuova scheda? Fammi sapere se hai domande!",
    "Ti aspetto in palestra! Buon allenamento!"
  ]

  const handleSend = async () => {
    if (!messageText.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: plan.phone,
          message: messageText
        })
      })

      if (res.ok) {
        onSent()
      } else {
        const data = await res.json()
        setError(data.error || 'Errore invio messaggio')
      }
    } catch (err) {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Invia Messaggio</h3>
            <p className="text-sm text-gray-500 mt-1">A: {plan.clientName} (+{plan.phone})</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {/* Quick Messages */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Messaggi rapidi</label>
            <div className="flex flex-wrap gap-2">
              {quickMessages.map((msg, idx) => (
                <button
                  key={idx}
                  onClick={() => setMessageText(msg)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                >
                  {msg.length > 30 ? msg.substring(0, 30) + '...' : msg}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Messaggio</label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Scrivi il tuo messaggio..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={handleSend}
              disabled={loading || !messageText.trim()}
              className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                'Invio...'
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Invia Messaggio
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ========== CREATE WORKOUT MODAL ==========
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
