import React, { useState, useEffect } from 'react'
import { Search, Phone, MessageSquare, MoreVertical, UserPlus, Filter, X } from 'lucide-react'

function ClientList() {
  const [clients, setClients] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
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

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients')
      if (res.ok) {
        const data = await res.json()
        setClients(data)
      }
    } catch (err) {
      console.error('Errore caricamento clienti:', err)
    }
  }

  const handleCreateClient = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Formatta il numero di telefono (rimuovi spazi e +)
      let phone = newClient.phone.replace(/\s+/g, '').replace(/^\+/, '')
      if (!phone.startsWith('39')) {
        phone = '39' + phone
      }

      const res = await fetch('/api/clients', {
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

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.phone?.includes(searchTerm)
    const matchesFilter = filter === 'all' || client.status === filter
    return matchesSearch && matchesFilter
  })

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    new: 'bg-blue-100 text-blue-700'
  }

  const statusLabels = {
    active: 'Attivo',
    inactive: 'Inattivo',
    new: 'Nuovo'
  }

  return (
    <div className="space-y-6">
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

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca per nome o telefono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Tutti</option>
            <option value="active">Attivi</option>
            <option value="inactive">Inattivi</option>
            <option value="new">Nuovi</option>
          </select>
        </div>
      </div>

      {/* Client Cards */}
      <div className="grid gap-4">
        {filteredClients.map((client) => (
          <div
            key={client.phone}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-700 font-bold text-lg">
                    {client.name?.charAt(0) || '?'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{client.name || 'Sconosciuto'}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[client.status] || statusColors.new}`}>
                      {statusLabels[client.status] || 'Nuovo'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      +{client.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {client.messagesCount || 0} messaggi
                    </span>
                  </div>
                </div>
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {client.objective && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Obiettivo</p>
                  <p className="font-medium text-gray-900">{client.objective}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Esperienza</p>
                  <p className="font-medium text-gray-900">{client.experience}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Giorni/Settimana</p>
                  <p className="font-medium text-gray-900">{client.daysPerWeek}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Ultimo Contatto</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(client.lastContact)}
                  </p>
                </div>
              </div>
            )}

            {!client.objective && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 italic">
                  Questionario non completato - Il coach sta raccogliendo le informazioni
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Nessun cliente trovato</p>
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
                  placeholder="393920434058"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">Formato: 39XXXXXXXXXX (con prefisso Italia)</p>
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
                  onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Obiettivo
                </label>
                <select
                  value={newClient.objective}
                  onChange={(e) => setNewClient({...newClient, objective: e.target.value})}
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
                  onChange={(e) => setNewClient({...newClient, experience: e.target.value})}
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
                  onChange={(e) => setNewClient({...newClient, daysPerWeek: parseInt(e.target.value)})}
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

function formatDate(date) {
  if (!date) return 'N/A'
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  const days = Math.floor(diff / 86400000)

  if (days === 0) return 'Oggi'
  if (days === 1) return 'Ieri'
  if (days < 7) return `${days} giorni fa`
  return d.toLocaleDateString('it-IT')
}

export default ClientList
