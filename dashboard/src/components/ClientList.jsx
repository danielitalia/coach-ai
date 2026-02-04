import React, { useState, useEffect } from 'react'
import { Search, Phone, MessageSquare, MoreVertical, UserPlus, Filter } from 'lucide-react'

function ClientList() {
  const [clients, setClients] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')

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
      // Demo data
      setClients([
        {
          phone: '393920434058',
          name: 'Daniel Ramos',
          status: 'active',
          objective: 'Massa muscolare',
          experience: 'Intermedio',
          daysPerWeek: 4,
          lastContact: new Date(),
          messagesCount: 12
        },
        {
          phone: '393331234567',
          name: 'Mario Rossi',
          status: 'active',
          objective: 'Dimagrire',
          experience: 'Principiante',
          daysPerWeek: 3,
          lastContact: new Date(Date.now() - 86400000),
          messagesCount: 8
        },
        {
          phone: '393389876543',
          name: 'Laura Bianchi',
          status: 'inactive',
          objective: 'Tonificare',
          experience: 'Esperto',
          daysPerWeek: 5,
          lastContact: new Date(Date.now() - 604800000),
          messagesCount: 24
        },
        {
          phone: '393401122334',
          name: 'Giuseppe Verdi',
          status: 'new',
          objective: null,
          experience: null,
          daysPerWeek: null,
          lastContact: new Date(),
          messagesCount: 2
        },
        {
          phone: '393285544332',
          name: 'Anna Neri',
          status: 'active',
          objective: 'Salute generale',
          experience: 'Principiante',
          daysPerWeek: 2,
          lastContact: new Date(Date.now() - 172800000),
          messagesCount: 15
        }
      ])
    }
  }

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.phone.includes(searchTerm)
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
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
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
                    {client.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{client.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[client.status]}`}>
                      {statusLabels[client.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      +{client.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {client.messagesCount} messaggi
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
