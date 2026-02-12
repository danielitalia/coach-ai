import React, { useState, useEffect } from 'react'
import {
  Building2, Users, MessageSquare, Activity, Plus, Edit, Trash2,
  Eye, Search, RefreshCw, ChevronDown, ChevronUp, X, Check,
  TrendingUp, Smartphone, Calendar, LogIn, ArrowLeft
} from 'lucide-react'
import { Link } from 'react-router-dom'

const SUPERADMIN_PASSWORD = 'CoachAI2024!' // Password temporanea - da cambiare in produzione

function SuperAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Check if already authenticated
  useEffect(() => {
    const auth = sessionStorage.getItem('superadmin_auth')
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === SUPERADMIN_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem('superadmin_auth', 'true')
      setError('')
    } else {
      setError('Password non valida')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('superadmin_auth')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Super Admin</h1>
            <p className="text-gray-500 mt-2">Accesso riservato agli amministratori</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Inserisci la password"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors"
            >
              Accedi
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
              Torna alla dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <SuperAdminDashboard onLogout={handleLogout} />
}

function SuperAdminDashboard({ onLogout }) {
  const [tenants, setTenants] = useState([])
  const [globalStats, setGlobalStats] = useState({
    totalTenants: 0,
    totalClients: 0,
    totalMessages: 0,
    activeToday: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedTenant, setExpandedTenant] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch all tenants
      const tenantsRes = await fetch('/api/superadmin/tenants')
      if (tenantsRes.ok) {
        const data = await tenantsRes.json()
        setTenants(data.tenants || [])
        setGlobalStats(data.stats || globalStats)
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    }
    setLoading(false)
  }

  const filteredTenants = tenants.filter(t =>
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDeleteTenant = async (tenantId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa palestra? Questa azione è irreversibile.')) {
      return
    }

    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('Error deleting tenant:', err)
    }
  }

  const handleImpersonate = (tenant) => {
    // Store impersonation info and redirect
    sessionStorage.setItem('impersonate_tenant', JSON.stringify(tenant))
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Super Admin</h1>
              <p className="text-gray-400 text-sm">Gestione Palestre</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Esci
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Global Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Building2}
            label="Palestre Totali"
            value={globalStats.totalTenants}
            color="red"
          />
          <StatCard
            icon={Users}
            label="Clienti Totali"
            value={globalStats.totalClients}
            color="blue"
          />
          <StatCard
            icon={MessageSquare}
            label="Messaggi Totali"
            value={globalStats.totalMessages}
            color="purple"
          />
          <StatCard
            icon={Activity}
            label="Attivi Oggi"
            value={globalStats.activeToday}
            color="green"
          />
        </div>

        {/* Tenants List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <h2 className="text-xl font-bold text-gray-900">Palestre</h2>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cerca palestra..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <button
                  onClick={() => fetchData()}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Nuova Palestra
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Caricamento...</p>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Nessuna palestra trovata</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTenants.map((tenant) => (
                <TenantRow
                  key={tenant.id}
                  tenant={tenant}
                  expanded={expandedTenant === tenant.id}
                  onToggleExpand={() => setExpandedTenant(expandedTenant === tenant.id ? null : tenant.id)}
                  onEdit={() => {
                    setSelectedTenant(tenant)
                    setShowEditModal(true)
                  }}
                  onDelete={() => handleDeleteTenant(tenant.id)}
                  onImpersonate={() => handleImpersonate(tenant)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <TenantModal
          onClose={() => setShowCreateModal(false)}
          onSave={() => {
            setShowCreateModal(false)
            fetchData()
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTenant && (
        <TenantModal
          tenant={selectedTenant}
          onClose={() => {
            setShowEditModal(false)
            setSelectedTenant(null)
          }}
          onSave={() => {
            setShowEditModal(false)
            setSelectedTenant(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

function TenantRow({ tenant, expanded, onToggleExpand, onEdit, onDelete, onImpersonate }) {
  return (
    <div className="hover:bg-gray-50">
      <div className="p-4 flex items-center gap-4">
        <button
          onClick={onToggleExpand}
          className="p-1 hover:bg-gray-200 rounded"
        >
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
          {tenant.name?.charAt(0) || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
          <p className="text-sm text-gray-500">{tenant.slug}</p>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{tenant.clientCount || 0} clienti</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span>{tenant.messageCount || 0} msg</span>
          </div>
          <div className={`flex items-center gap-2 ${tenant.whatsappConnected ? 'text-green-600' : 'text-orange-500'}`}>
            <Smartphone className="w-4 h-4" />
            <span>{tenant.whatsappConnected ? 'Connesso' : 'Non connesso'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onImpersonate}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            title="Accedi come questa palestra"
          >
            <LogIn className="w-5 h-5" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Modifica"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
            title="Elimina"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pl-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Coach Name</p>
            <p className="font-medium">{tenant.coachName || 'Coach AI'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">WhatsApp</p>
            <p className="font-medium">{tenant.whatsappNumber || 'Non configurato'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Creato il</p>
            <p className="font-medium">
              {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString('it-IT') : 'N/A'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function TenantModal({ tenant, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    slug: tenant?.slug || '',
    coachName: tenant?.coachName || tenant?.coach_name || 'Coach AI',
    useEmoji: tenant?.useEmoji ?? tenant?.use_emoji ?? true,
    whatsappInstanceName: tenant?.whatsappInstanceName || tenant?.whatsapp_instance_name || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const url = tenant
        ? `/api/superadmin/tenants/${tenant.id}`
        : '/api/superadmin/tenants'

      const res = await fetch(url, {
        method: tenant ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        onSave()
      } else {
        const data = await res.json()
        setError(data.error || 'Errore durante il salvataggio')
      }
    } catch (err) {
      setError('Errore di connessione')
    }
    setLoading(false)
  }

  // Auto-generate slug from name
  const handleNameChange = (name) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: !tenant ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : prev.slug
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {tenant ? 'Modifica Palestra' : 'Nuova Palestra'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome Palestra *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Es. Fitness Club Roma"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slug (URL) *
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="fitness-club-roma"
              required
              disabled={!!tenant}
            />
            <p className="text-xs text-gray-500 mt-1">Identificatore unico, non modificabile dopo la creazione</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome Coach AI
            </label>
            <input
              type="text"
              value={formData.coachName}
              onChange={(e) => setFormData(prev => ({ ...prev, coachName: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Coach AI"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome Istanza WhatsApp
            </label>
            <input
              type="text"
              value={formData.whatsappInstanceName}
              onChange={(e) => setFormData(prev => ({ ...prev, whatsappInstanceName: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="coach-ai"
            />
            <p className="text-xs text-gray-500 mt-1">Nome dell'istanza in Evolution API</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="useEmoji"
              checked={formData.useEmoji}
              onChange={(e) => setFormData(prev => ({ ...prev, useEmoji: e.target.checked }))}
              className="w-5 h-5 text-red-500 rounded focus:ring-red-500"
            />
            <label htmlFor="useEmoji" className="text-sm text-gray-700">
              Usa emoji nei messaggi
            </label>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvataggio...' : (tenant ? 'Salva Modifiche' : 'Crea Palestra')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SuperAdmin
