import React, { useState, useEffect, useCallback } from 'react'
import {
  QrCode, Users, TrendingUp, Calendar, Clock, Download,
  Printer, RefreshCw, Loader2, AlertCircle, CheckCircle,
  Flame, Trophy, User, UserPlus, X
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || ''

function CheckIn() {
  const { authFetch } = useAuth()
  const [qrData, setQrData] = useState(null)
  const [todayCheckins, setTodayCheckins] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddClient, setShowAddClient] = useState(null) // phone del checkin da registrare
  const [addClientForm, setAddClientForm] = useState({ name: '', objective: '', experience: '', daysPerWeek: 3 })
  const [addClientLoading, setAddClientLoading] = useState(false)
  const [addClientError, setAddClientError] = useState('')
  const [addClientSuccess, setAddClientSuccess] = useState('')

  const fetchQrCode = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/checkin-qrcode`)
      if (res.ok) {
        const data = await res.json()
        setQrData(data)
        setError(null)
      } else {
        const errData = await res.json()
        setError(errData.message || 'Errore nel recupero del QR Code')
      }
    } catch (err) {
      console.error('Errore fetch QR:', err)
      setError('Errore di connessione')
    }
  }, [authFetch])

  const fetchTodayCheckins = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/checkins/today`)
      if (res.ok) {
        const data = await res.json()
        setTodayCheckins(data)
      }
    } catch (err) {
      console.error('Errore fetch checkins:', err)
    }
  }, [authFetch])

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/checkins-stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Errore fetch stats:', err)
    }
  }, [authFetch])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchQrCode(), fetchTodayCheckins(), fetchStats()])
      setLoading(false)
    }
    init()

    // Aggiorna check-in ogni 30 secondi
    const interval = setInterval(fetchTodayCheckins, 30000)
    return () => clearInterval(interval)
  }, [fetchQrCode, fetchTodayCheckins, fetchStats])

  const handleAddClient = async (e) => {
    e.preventDefault()
    if (!showAddClient) return
    setAddClientLoading(true)
    setAddClientError('')

    try {
      const res = await authFetch(`${API_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: showAddClient,
          name: addClientForm.name,
          objective: addClientForm.objective,
          experience: addClientForm.experience,
          daysPerWeek: addClientForm.daysPerWeek
        })
      })

      if (res.ok) {
        setAddClientSuccess(`${addClientForm.name} registrato come cliente!`)
        setShowAddClient(null)
        setAddClientForm({ name: '', objective: '', experience: '', daysPerWeek: 3 })
        // Aggiorna la lista checkin per riflettere il nuovo stato
        fetchTodayCheckins()
        setTimeout(() => setAddClientSuccess(''), 4000)
      } else {
        const data = await res.json()
        setAddClientError(data.error || 'Errore nella registrazione')
      }
    } catch (err) {
      setAddClientError('Errore di connessione')
    } finally {
      setAddClientLoading(false)
    }
  }

  const openAddClient = (checkin) => {
    setShowAddClient(checkin.phone)
    setAddClientForm({
      name: checkin.name || '',
      objective: '',
      experience: '',
      daysPerWeek: 3
    })
    setAddClientError('')
  }

  const handlePrint = () => {
    if (!qrData?.qrCodeUrl) return

    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code Check-in - Coach AI</title>
        <style>
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            font-family: Arial, sans-serif;
          }
          .container {
            text-align: center;
            padding: 40px;
          }
          h1 {
            font-size: 32px;
            margin-bottom: 10px;
            color: #1a1a1a;
          }
          p {
            font-size: 18px;
            color: #666;
            margin-bottom: 30px;
          }
          img {
            width: 300px;
            height: 300px;
          }
          .instructions {
            margin-top: 30px;
            font-size: 16px;
            color: #444;
          }
          .step {
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>CHECK-IN PALESTRA</h1>
          <p>Scansiona con il tuo telefono per registrare la presenza</p>
          <img src="${qrData.qrCodeUrl}" alt="QR Code Check-in" />
          <div class="instructions">
            <div class="step">1. Scansiona il QR Code con la fotocamera</div>
            <div class="step">2. Si aprira WhatsApp</div>
            <div class="step">3. Premi Invia per fare check-in</div>
            <div class="step">4. Riceverai la tua scheda del giorno!</div>
          </div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleDownload = () => {
    if (!qrData?.qrCodeUrl) return

    const link = document.createElement('a')
    link.href = qrData.qrCodeUrl
    link.download = 'checkin-qrcode.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Check-in Palestra</h2>
        <p className="text-gray-500 mt-1">QR Code per la registrazione automatica delle presenze</p>
      </div>

      {/* Success message */}
      {addClientSuccess && (
        <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {addClientSuccess}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.today}</p>
                <p className="text-sm text-gray-500">Check-in Oggi</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.thisWeek}</p>
                <p className="text-sm text-gray-500">Questa Settimana</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.thisMonth}</p>
                <p className="text-sm text-gray-500">Questo Mese</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.uniqueClients}</p>
                <p className="text-sm text-gray-500">Clienti Attivi</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary-500" />
              QR Code Check-in
            </h3>
            <button
              onClick={fetchQrCode}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {error ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">{error}</p>
              <a
                href="/whatsapp"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Collega WhatsApp
              </a>
            </div>
          ) : qrData ? (
            <div className="text-center">
              <div className="inline-block p-4 bg-gray-50 rounded-xl mb-4">
                <img
                  src={qrData.qrCodeUrl}
                  alt="QR Code Check-in"
                  className="w-64 h-64"
                />
              </div>

              <p className="text-sm text-gray-500 mb-4">
                Numero palestra: <strong>{qrData.gymPhone}</strong>
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Stampa
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Scarica
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          )}

          {/* Instructions */}
          {qrData && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Come funziona</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                {qrData.instructions?.map((instruction, i) => (
                  <li key={i}>{instruction}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Today's Check-ins */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-500" />
              Check-in di Oggi
            </h3>
            <span className="px-2 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
              {todayCheckins.length} presenti
            </span>
          </div>

          {todayCheckins.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {todayCheckins.map((checkin, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${checkin.is_client ? 'bg-primary-100' : 'bg-orange-100'}`}>
                      <User className={`w-5 h-5 ${checkin.is_client ? 'text-primary-600' : 'text-orange-600'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{checkin.name || `+${checkin.phone}`}</p>
                        {!checkin.is_client && (
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded uppercase">
                            Non registrato
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{checkin.workoutDay || checkin.workout_day || 'Allenamento libero'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!checkin.is_client && (
                      <button
                        onClick={() => openAddClient(checkin)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600 transition-colors"
                        title="Registra come cliente"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Registra</span>
                      </button>
                    )}
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(checkin.checked_in_at || checkin.checkedInAt).toLocaleTimeString('it-IT', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <p className="text-xs text-gray-500">check-in</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nessun check-in oggi</p>
              <p className="text-sm text-gray-400 mt-1">I check-in appariranno qui in tempo reale</p>
            </div>
          )}
        </div>
      </div>

      {/* Tips Card */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">Suggerimento</h3>
            <p className="text-white/90">
              Stampa il QR Code e posizionalo all'ingresso della palestra. I clienti potranno fare check-in
              semplicemente scansionandolo con il telefono e riceveranno automaticamente la loro scheda del giorno!
            </p>
          </div>
        </div>
      </div>

      {/* Modal Aggiungi Cliente */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary-500" />
                Registra Cliente
              </h3>
              <button onClick={() => setShowAddClient(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Telefono: <strong>+{showAddClient}</strong>
            </p>

            {addClientError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {addClientError}
              </div>
            )}

            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  required
                  placeholder="Mario Rossi"
                  value={addClientForm.name}
                  onChange={(e) => setAddClientForm({ ...addClientForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Obiettivo</label>
                <select
                  value={addClientForm.objective}
                  onChange={(e) => setAddClientForm({ ...addClientForm, objective: e.target.value })}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Esperienza</label>
                <select
                  value={addClientForm.experience}
                  onChange={(e) => setAddClientForm({ ...addClientForm, experience: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleziona...</option>
                  <option value="Principiante">Principiante</option>
                  <option value="Intermedio">Intermedio</option>
                  <option value="Esperto">Esperto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giorni/Settimana</label>
                <select
                  value={addClientForm.daysPerWeek}
                  onChange={(e) => setAddClientForm({ ...addClientForm, daysPerWeek: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={2}>2 giorni</option>
                  <option value={3}>3 giorni</option>
                  <option value={4}>4 giorni</option>
                  <option value={5}>5 giorni</option>
                  <option value={6}>6 giorni</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClient(null)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={addClientLoading}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  {addClientLoading ? 'Registrazione...' : 'Registra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CheckIn
