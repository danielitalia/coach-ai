import React from 'react'
import { TrendingUp, Users, MessageSquare, Clock } from 'lucide-react'

function Analytics() {
  const weeklyData = [
    { day: 'Lun', messages: 24, clients: 8 },
    { day: 'Mar', messages: 32, clients: 12 },
    { day: 'Mer', messages: 28, clients: 10 },
    { day: 'Gio', messages: 45, clients: 15 },
    { day: 'Ven', messages: 38, clients: 14 },
    { day: 'Sab', messages: 15, clients: 6 },
    { day: 'Dom', messages: 8, clients: 3 },
  ]

  const maxMessages = Math.max(...weeklyData.map(d => d.messages))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        <p className="text-gray-500">Statistiche e performance del tuo Coach AI</p>
      </div>

      {/* Weekly Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-6">Messaggi Settimanali</h3>
        <div className="flex items-end justify-between gap-2 h-48">
          {weeklyData.map((data, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full bg-primary-500 rounded-t-lg transition-all hover:bg-primary-600"
                style={{ height: `${(data.messages / maxMessages) * 100}%` }}
              />
              <span className="text-xs text-gray-500">{data.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Tasso di Conversione</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">78%</p>
          <p className="text-sm text-gray-500 mt-1">
            Clienti che completano il questionario
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Tempo Medio Risposta</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">2.3s</p>
          <p className="text-sm text-gray-500 mt-1">
            Tempo medio di risposta AI
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Retention Rate</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">85%</p>
          <p className="text-sm text-gray-500 mt-1">
            Clienti attivi dopo 30 giorni
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Media Messaggi/Cliente</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">12.4</p>
          <p className="text-sm text-gray-500 mt-1">
            Messaggi medi per cliente
          </p>
        </div>
      </div>

      {/* Top Objectives */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Obiettivi Piu Richiesti</h3>
        <div className="space-y-4">
          {[
            { label: 'Dimagrire', percentage: 42 },
            { label: 'Massa Muscolare', percentage: 28 },
            { label: 'Tonificare', percentage: 18 },
            { label: 'Salute Generale', percentage: 12 },
          ].map((item, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <span className="text-sm text-gray-500">{item.percentage}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Analytics
