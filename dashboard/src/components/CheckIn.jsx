import React, { useState, useEffect, useCallback } from 'react'
import {
  QrCode, Users, TrendingUp, Calendar, Clock, Download,
  Printer, RefreshCw, Loader2, AlertCircle, CheckCircle,
  Flame, Trophy, User
} from 'lucide-react'

const API_URL = ''

function CheckIn() {
  const [qrData, setQrData] = useState(null)
  const [todayCheckins, setTodayCheckins] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchQrCode = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/checkin-qrcode`)
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
  }, [])

  const fetchTodayCheckins = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/checkins/today`)
      if (res.ok) {
        const data = await res.json()
        setTodayCheckins(data)
      }
    } catch (err) {
      console.error('Errore fetch checkins:', err)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/checkins-stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Errore fetch stats:', err)
    }
  }, [])

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
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{checkin.name}</p>
                      <p className="text-sm text-gray-500">{checkin.workoutDay || 'Allenamento libero'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(checkin.checkedInAt).toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-xs text-gray-500">check-in</p>
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
    </div>
  )
}

export default CheckIn
