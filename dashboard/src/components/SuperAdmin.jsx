import React, { useState, useEffect } from 'react'
import {
  Building2, Users, MessageSquare, Activity, Plus, Edit, Trash2,
  Eye, Search, RefreshCw, ChevronDown, ChevronUp, X, Check,
  TrendingUp, Smartphone, Calendar, LogIn, ArrowLeft, CreditCard,
  AlertTriangle, CheckCircle, Clock, FileText, Bell, Wifi, WifiOff,
  Server, Database, Send, Shield
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
  const [activeTab, setActiveTab] = useState('tenants') // 'tenants' or 'monitoring'
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

  // Monitoring state
  const [monitoringStats, setMonitoringStats] = useState(null)
  const [healthStatus, setHealthStatus] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [monitoringLoading, setMonitoringLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (activeTab === 'monitoring') {
      fetchMonitoringData()
    }
  }, [activeTab])

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

  const fetchMonitoringData = async () => {
    setMonitoringLoading(true)
    try {
      const [statsRes, healthRes, alertsRes] = await Promise.all([
        fetch('/api/monitoring/stats'),
        fetch('/api/monitoring/health'),
        fetch('/api/monitoring/alerts?limit=20')
      ])

      if (statsRes.ok) setMonitoringStats(await statsRes.json())
      if (healthRes.ok) setHealthStatus(await healthRes.json())
      if (alertsRes.ok) {
        const data = await alertsRes.json()
        setAlerts(data.alerts || [])
      }
    } catch (err) {
      console.error('Error fetching monitoring data:', err)
    }
    setMonitoringLoading(false)
  }

  const testTelegram = async () => {
    try {
      const res = await fetch('/api/monitoring/test-telegram', { method: 'POST' })
      if (res.ok) {
        alert('Test alert inviato a Telegram!')
      } else {
        alert('Errore nell\'invio del test')
      }
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  const acknowledgeAlert = async (alertId) => {
    try {
      await fetch(`/api/monitoring/alerts/${alertId}/acknowledge`, { method: 'POST' })
      fetchMonitoringData()
    } catch (err) {
      console.error('Error acknowledging alert:', err)
    }
  }

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
          <div className="flex items-center gap-4">
            {/* Tabs */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('tenants')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'tenants' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4 inline mr-2" />
                Palestre
              </button>
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'monitoring' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4 inline mr-2" />
                Monitoring
              </button>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Esci
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* TENANTS TAB */}
        {activeTab === 'tenants' && (
          <>
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
          </>
        )}

        {/* MONITORING TAB */}
        {activeTab === 'monitoring' && (
          <>
            {/* Monitoring Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={Wifi}
                label="WhatsApp Connessi"
                value={monitoringStats?.connected_tenants || 0}
                color="green"
              />
              <StatCard
                icon={WifiOff}
                label="WhatsApp Disconnessi"
                value={monitoringStats?.disconnected_tenants || 0}
                color="red"
              />
              <StatCard
                icon={Bell}
                label="Alert (24h)"
                value={monitoringStats?.alerts_24h || 0}
                color="purple"
              />
              <StatCard
                icon={AlertTriangle}
                label="Errori da Risolvere"
                value={monitoringStats?.unacknowledged_errors || 0}
                color="red"
              />
            </div>

            {/* Health Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* System Health */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Stato Sistemi</h3>
                  <button
                    onClick={fetchMonitoringData}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    disabled={monitoringLoading}
                  >
                    <RefreshCw className={`w-5 h-5 ${monitoringLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {healthStatus ? (
                  <div className="space-y-3">
                    <HealthItem
                      icon={Database}
                      label="Database"
                      status={healthStatus.database?.healthy ? 'online' : 'offline'}
                    />
                    <HealthItem
                      icon={Server}
                      label="Evolution API"
                      status={healthStatus.evolutionApi?.healthy ? 'online' : 'offline'}
                    />
                    <div className="border-t pt-3 mt-3">
                      <p className="text-sm text-gray-500 mb-2">WhatsApp per Tenant:</p>
                      {healthStatus.whatsappConnections?.map((t, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <span className="text-sm text-gray-700">{t.name}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            t.connected
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {t.connected ? 'Connesso' : t.reason || 'Disconnesso'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {monitoringLoading ? 'Caricamento...' : 'Clicca refresh per controllare'}
                  </div>
                )}
              </div>

              {/* Telegram Config */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-4">Configurazione Alert</h3>

                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-700">
                    <Bell className="w-4 h-4 inline mr-2" />
                    Gli alert vengono inviati via Telegram quando:
                  </p>
                  <ul className="text-sm text-blue-600 mt-2 ml-6 list-disc">
                    <li>WhatsApp si disconnette</li>
                    <li>Database non raggiungibile</li>
                    <li>Evolution API down</li>
                    <li>Abbonamenti in scadenza</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Report Giornaliero</p>
                      <p className="text-sm text-gray-500">Ogni giorno alle 9:00</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Health Check</p>
                      <p className="text-sm text-gray-500">Ogni 5 minuti</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Alert Abbonamenti</p>
                      <p className="text-sm text-gray-500">7 giorni prima della scadenza</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                </div>

                <button
                  onClick={testTelegram}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Send className="w-5 h-5" />
                  Invia Test Alert
                </button>
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="font-bold text-gray-900">Alert Recenti</h3>
              </div>

              {alerts.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-4" />
                  <p className="text-gray-500">Nessun alert recente</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              alert.severity === 'error' ? 'bg-red-500' :
                              alert.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`} />
                            <span className="font-medium text-gray-900">{alert.title}</span>
                            {alert.acknowledged && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                Risolto
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{alert.message}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(alert.created_at).toLocaleString('it-IT')}
                          </p>
                        </div>
                        {!alert.acknowledged && (
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                          >
                            Risolvi
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
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

function HealthItem({ icon: Icon, label, status }) {
  const isOnline = status === 'online'

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${isOnline ? 'text-green-600' : 'text-red-600'}`} />
        <span className="font-medium text-gray-900">{label}</span>
      </div>
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
        isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}>
        {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        <span className="text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</span>
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
          <SubscriptionBadge tenant={tenant} />
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
        <div className="px-4 pb-4 pl-16 space-y-4">
          {/* Subscription Info */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-blue-900">Abbonamento</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Piano</p>
                <p className="font-semibold text-blue-900 capitalize">{tenant.subscriptionPlan || tenant.subscription_plan || 'trial'}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Stato</p>
                <p className={`font-semibold capitalize ${
                  (tenant.subscriptionStatus || tenant.subscription_status) === 'active' ? 'text-green-600' :
                  (tenant.subscriptionStatus || tenant.subscription_status) === 'suspended' ? 'text-orange-600' :
                  'text-red-600'
                }`}>
                  {tenant.subscriptionStatus || tenant.subscription_status || 'active'}
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Scadenza</p>
                <p className="font-semibold text-blue-900">
                  {tenant.subscriptionExpiresAt || tenant.subscription_expires_at
                    ? new Date(tenant.subscriptionExpiresAt || tenant.subscription_expires_at).toLocaleDateString('it-IT')
                    : 'Nessuna'}
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Prezzo</p>
                <p className="font-semibold text-blue-900">
                  {tenant.subscriptionPrice || tenant.subscription_price
                    ? `€${tenant.subscriptionPrice || tenant.subscription_price}/mese`
                    : '-'}
                </p>
              </div>
            </div>
            {(tenant.subscriptionNotes || tenant.subscription_notes) && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Note</p>
                <p className="text-sm text-blue-800">{tenant.subscriptionNotes || tenant.subscription_notes}</p>
              </div>
            )}
          </div>

          {/* General Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Coach Name</p>
              <p className="font-medium">{tenant.coachName || tenant.coach_name || 'Coach AI'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">WhatsApp</p>
              <p className="font-medium">{tenant.whatsappNumber || tenant.whatsapp_number || 'Non configurato'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Creato il</p>
              <p className="font-medium">
                {(tenant.createdAt || tenant.created_at) ? new Date(tenant.createdAt || tenant.created_at).toLocaleDateString('it-IT') : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SubscriptionBadge({ tenant }) {
  const status = tenant.subscriptionStatus || tenant.subscription_status || 'active'
  const plan = tenant.subscriptionPlan || tenant.subscription_plan || 'trial'
  const expiresAt = tenant.subscriptionExpiresAt || tenant.subscription_expires_at

  // Check if expiring soon (within 7 days)
  const isExpiringSoon = expiresAt && new Date(expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const isExpired = expiresAt && new Date(expiresAt) < new Date()

  if (status === 'suspended' || isExpired) {
    return (
      <div className="flex items-center gap-1 text-red-600">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs font-medium">Sospeso</span>
      </div>
    )
  }

  if (isExpiringSoon) {
    return (
      <div className="flex items-center gap-1 text-orange-600">
        <Clock className="w-4 h-4" />
        <span className="text-xs font-medium">In scadenza</span>
      </div>
    )
  }

  const planColors = {
    trial: 'text-gray-600',
    basic: 'text-blue-600',
    pro: 'text-purple-600',
    enterprise: 'text-amber-600'
  }

  return (
    <div className={`flex items-center gap-1 ${planColors[plan] || 'text-gray-600'}`}>
      <CheckCircle className="w-4 h-4" />
      <span className="text-xs font-medium capitalize">{plan}</span>
    </div>
  )
}

function TenantModal({ tenant, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    slug: tenant?.slug || '',
    coachName: tenant?.coachName || tenant?.coach_name || 'Coach AI',
    useEmoji: tenant?.useEmoji ?? tenant?.use_emoji ?? true,
    whatsappInstanceName: tenant?.whatsappInstanceName || tenant?.whatsapp_instance_name || '',
    subscriptionPlan: tenant?.subscriptionPlan || tenant?.subscription_plan || 'trial',
    subscriptionStatus: tenant?.subscriptionStatus || tenant?.subscription_status || 'active',
    subscriptionExpiresAt: tenant?.subscriptionExpiresAt || tenant?.subscription_expires_at || '',
    subscriptionPrice: tenant?.subscriptionPrice || tenant?.subscription_price || '',
    subscriptionNotes: tenant?.subscriptionNotes || tenant?.subscription_notes || ''
  })
  const [activeTab, setActiveTab] = useState('general')
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

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Building2 className="w-4 h-4 inline mr-2" />
              Generale
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('subscription')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'subscription'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <CreditCard className="w-4 h-4 inline mr-2" />
              Abbonamento
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* General Tab */}
          {activeTab === 'general' && (
            <>
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
            </>
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <>
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-700">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Gestisci l'abbonamento di questa palestra. I pagamenti sono gestiti esternamente (bonifico, contratto).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Piano
                  </label>
                  <select
                    value={formData.subscriptionPlan}
                    onChange={(e) => setFormData(prev => ({ ...prev, subscriptionPlan: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="trial">Trial (Prova)</option>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stato
                  </label>
                  <select
                    value={formData.subscriptionStatus}
                    onChange={(e) => setFormData(prev => ({ ...prev, subscriptionStatus: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="active">Attivo</option>
                    <option value="suspended">Sospeso</option>
                    <option value="cancelled">Cancellato</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Scadenza
                  </label>
                  <input
                    type="date"
                    value={formData.subscriptionExpiresAt ? formData.subscriptionExpiresAt.split('T')[0] : ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, subscriptionExpiresAt: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lascia vuoto per abbonamento senza scadenza</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prezzo (€/mese)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.subscriptionPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, subscriptionPrice: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="99.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note Abbonamento
                </label>
                <textarea
                  value={formData.subscriptionNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, subscriptionNotes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Es. Contratto firmato il 15/02/2024, pagamento trimestrale..."
                />
                <p className="text-xs text-gray-500 mt-1">Informazioni aggiuntive sul contratto o pagamento</p>
              </div>

              {/* Quick Actions */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Azioni rapide</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextMonth = new Date()
                      nextMonth.setMonth(nextMonth.getMonth() + 1)
                      setFormData(prev => ({
                        ...prev,
                        subscriptionExpiresAt: nextMonth.toISOString().split('T')[0]
                      }))
                    }}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    +1 Mese
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextYear = new Date()
                      nextYear.setFullYear(nextYear.getFullYear() + 1)
                      setFormData(prev => ({
                        ...prev,
                        subscriptionExpiresAt: nextYear.toISOString().split('T')[0]
                      }))
                    }}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    +1 Anno
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      subscriptionStatus: 'active',
                      subscriptionPlan: 'pro'
                    }))}
                    className="px-3 py-1.5 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors"
                  >
                    Attiva Pro
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      subscriptionStatus: 'suspended'
                    }))}
                    className="px-3 py-1.5 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors"
                  >
                    Sospendi
                  </button>
                </div>
              </div>
            </>
          )}

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
