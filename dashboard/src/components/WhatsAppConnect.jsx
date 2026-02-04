import React, { useState, useEffect, useCallback } from 'react'
import {
  MessageCircle, RefreshCw, Power, PowerOff, CheckCircle,
  AlertCircle, Loader2, Smartphone, QrCode, User, Phone
} from 'lucide-react'

const API_URL = ''

function WhatsAppConnect() {
  const [status, setStatus] = useState({ connected: false, state: 'unknown' })
  const [qrCode, setQrCode] = useState(null)
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/whatsapp/status`)
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
        return data.connected
      }
    } catch (err) {
      console.error('Errore fetch status:', err)
    }
    return false
  }, [])

  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/whatsapp/info`)
      if (res.ok) {
        const data = await res.json()
        setInfo(data)
      }
    } catch (err) {
      console.error('Errore fetch info:', err)
    }
  }, [])

  const fetchQrCode = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`${API_URL}/api/whatsapp/qrcode`)
      if (res.ok) {
        const data = await res.json()
        if (data.connected) {
          setQrCode(null)
          setStatus({ connected: true, state: 'open' })
        } else if (data.qrcode) {
          setQrCode(data.qrcode)
        }
      }
    } catch (err) {
      console.error('Errore fetch QR:', err)
      setError('Errore nel recupero del QR code')
    }
  }, [])

  const handleDisconnect = async () => {
    if (!confirm('Sei sicuro di voler disconnettere WhatsApp?')) return

    setActionLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/whatsapp/disconnect`, { method: 'POST' })
      if (res.ok) {
        setStatus({ connected: false, state: 'close' })
        setQrCode(null)
        setInfo(null)
        // Fetch new QR code after disconnect
        setTimeout(fetchQrCode, 1000)
      }
    } catch (err) {
      setError('Errore nella disconnessione')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRefreshQr = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/whatsapp/restart`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.qrcode) {
          setQrCode(data.qrcode)
        } else {
          // Wait and fetch QR
          setTimeout(fetchQrCode, 1000)
        }
      }
    } catch (err) {
      setError('Errore nel refresh del QR code')
    } finally {
      setActionLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const connected = await fetchStatus()
      if (connected) {
        await fetchInfo()
      } else {
        await fetchQrCode()
      }
      setLoading(false)
    }
    init()
  }, [fetchStatus, fetchInfo, fetchQrCode])

  // Poll for status changes when showing QR
  useEffect(() => {
    if (!status.connected && qrCode) {
      const interval = setInterval(async () => {
        const connected = await fetchStatus()
        if (connected) {
          setQrCode(null)
          await fetchInfo()
        }
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [status.connected, qrCode, fetchStatus, fetchInfo])

  // Refresh QR code every 45 seconds if not connected
  useEffect(() => {
    if (!status.connected && qrCode) {
      const interval = setInterval(fetchQrCode, 45000)
      return () => clearInterval(interval)
    }
  }, [status.connected, qrCode, fetchQrCode])

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
        <h2 className="text-2xl font-bold text-gray-900">Connessione WhatsApp</h2>
        <p className="text-gray-500 mt-1">Collega il numero WhatsApp della palestra per ricevere e inviare messaggi</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              status.connected ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <MessageCircle className={`w-6 h-6 ${
                status.connected ? 'text-green-600' : 'text-gray-400'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {status.connected ? 'WhatsApp Connesso' : 'WhatsApp Non Connesso'}
              </h3>
              <p className="text-sm text-gray-500">
                Stato: <span className={status.connected ? 'text-green-600' : 'text-orange-500'}>
                  {status.state === 'open' ? 'Online' : status.state === 'connecting' ? 'Connessione in corso...' : 'Offline'}
                </span>
              </p>
            </div>
          </div>

          {status.connected && (
            <button
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PowerOff className="w-4 h-4" />
              )}
              Disconnetti
            </button>
          )}
        </div>

        {/* Connected State - Show Profile Info */}
        {status.connected && info && (
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-4">
              {info.profilePicUrl ? (
                <img
                  src={info.profilePicUrl}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div>
                <h4 className="font-semibold text-gray-900">{info.profileName || 'Nome non disponibile'}</h4>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {info.ownerJid?.replace('@s.whatsapp.net', '') || 'Numero non disponibile'}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600">Pronto per ricevere messaggi</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Disconnected State - Show QR Code */}
        {!status.connected && (
          <div className="border-t border-gray-200 pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600 font-medium">Scansiona il QR Code con WhatsApp</span>
              </div>

              {qrCode ? (
                <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-xl">
                  <img
                    src={qrCode}
                    alt="WhatsApp QR Code"
                    className="w-64 h-64"
                  />
                </div>
              ) : (
                <div className="inline-block p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="w-64 h-64 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <button
                  onClick={handleRefreshQr}
                  disabled={actionLoading}
                  className="flex items-center gap-2 mx-auto px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Genera nuovo QR Code
                </button>

                <p className="text-sm text-gray-500">
                  Il QR Code si aggiorna automaticamente ogni 45 secondi
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Come collegare WhatsApp
              </h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Apri WhatsApp sul telefono della palestra</li>
                <li>Vai su <strong>Impostazioni → Dispositivi collegati</strong></li>
                <li>Tocca <strong>Collega un dispositivo</strong></li>
                <li>Scansiona il QR Code qui sopra</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Informazioni</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Istanza</span>
            <span className="font-medium text-gray-900">{status.instanceName || info?.instanceName || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Stato connessione</span>
            <span className={`font-medium ${status.connected ? 'text-green-600' : 'text-orange-500'}`}>
              {status.connected ? 'Connesso' : 'Disconnesso'}
            </span>
          </div>
          {info?.profileName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Profilo</span>
              <span className="font-medium text-gray-900">{info.profileName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WhatsAppConnect
