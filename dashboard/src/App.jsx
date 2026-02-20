import React, { useState, useEffect } from 'react'
const API_URL = import.meta.env.VITE_API_URL || ''
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import {
  Users, MessageSquare, BarChart3, Settings as SettingsIcon,
  Dumbbell, Menu, X, Phone, Clock, TrendingUp,
  UserPlus, Activity, Calendar, Bell, Smartphone, QrCode, Gift,
  LogOut, User, ChevronDown, Zap, Brain
} from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import ClientList from './components/ClientList'
import Conversations from './components/Conversations'
import Analytics from './components/Analytics'
import Reminders from './components/Reminders'
import WorkoutPlans from './components/WorkoutPlans'
import SettingsPage from './components/Settings'
import WhatsAppConnect from './components/WhatsAppConnect'
import CheckIn from './components/CheckIn'
import Referral from './components/Referral'
import Automations from './components/Automations'
import SuperAdmin from './components/SuperAdmin'
import OnboardingWizard from './components/OnboardingWizard'
import BrainInsights from './components/BrainInsights'

// Protected Route component
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function Sidebar({ isOpen, setIsOpen, whatsappStatus }) {
  const location = useLocation()
  const { logout, user, tenant } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const links = [
    { to: '/', icon: BarChart3, label: 'Dashboard' },
    { to: '/clients', icon: Users, label: 'Clienti' },
    { to: '/conversations', icon: MessageSquare, label: 'Conversazioni' },
    { to: '/workouts', icon: Dumbbell, label: 'Schede' },
    { to: '/checkin', icon: QrCode, label: 'Check-in' },
    { to: '/referral', icon: Gift, label: 'Referral' },
    { to: '/brain', icon: Brain, label: 'Brain AI' },
    { to: '/automations', icon: Zap, label: 'Automazioni' },
    { to: '/reminders', icon: Bell, label: 'Promemoria' },
    { to: '/whatsapp', icon: Smartphone, label: 'WhatsApp' },
    { to: '/settings', icon: SettingsIcon, label: 'Impostazioni' },
  ]

  const handleLogout = async () => {
    await logout()
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-30 h-full w-64 bg-white border-r border-gray-200
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center gap-3 p-6 border-b border-gray-200">
          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
            <Dumbbell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Coach AI</h1>
            <p className="text-xs text-gray-500">Dashboard Palestra</p>
          </div>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {links.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setIsOpen(false)}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                ${location.pathname === to
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'}
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </Link>
          ))}
        </nav>

        {/* WhatsApp Status */}
        <div className="p-4 border-t border-gray-200">
          <Link
            to="/whatsapp"
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
              whatsappStatus?.connected
                ? 'bg-green-50 hover:bg-green-100'
                : 'bg-orange-50 hover:bg-orange-100'
            } transition-colors`}
          >
            <div className={`w-2 h-2 rounded-full ${
              whatsappStatus?.connected
                ? 'bg-green-500 animate-pulse'
                : 'bg-orange-500'
            }`} />
            <span className={`text-sm font-medium ${
              whatsappStatus?.connected
                ? 'text-green-700'
                : 'text-orange-700'
            }`}>
              {whatsappStatus?.connected ? 'WhatsApp Connesso' : 'Connetti WhatsApp'}
            </span>
          </Link>
        </div>

        {/* User Menu */}
        <div className="p-4 border-t border-gray-200">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'Utente'}</p>
                <p className="text-xs text-gray-500 truncate">{tenant?.name || 'Palestra'}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Esci</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

function Dashboard() {
  const { tenant, authFetch } = useAuth()
  const [stats, setStats] = useState({
    totalClients: 0,
    activeToday: 0,
    messagesThisWeek: 0,
    responseRate: 0
  })
  const [recentClients, setRecentClients] = useState([])

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.log('Stats API not available yet')
    }
  }

  const statCards = [
    { label: 'Clienti Totali', value: stats.totalClients, icon: Users, color: 'blue' },
    { label: 'Attivi Oggi', value: stats.activeToday, icon: Activity, color: 'green' },
    { label: 'Messaggi Settimana', value: stats.messagesThisWeek, icon: MessageSquare, color: 'purple' },
    { label: 'Tasso Risposta', value: `${stats.responseRate}%`, icon: TrendingUp, color: 'orange' },
  ]

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500">Panoramica delle attivita di {tenant?.name || 'Coach AI'}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-6 border border-gray-200">
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
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Conversazioni Recenti</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {recentClients.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>Nessuna conversazione recente</p>
              </div>
            ) : (
              recentClients.map((client, i) => (
                <div key={i} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-700 font-medium">
                        {client.name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-sm text-gray-500 truncate">{client.lastMessage}</p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatTime(client.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <Link
            to="/conversations"
            className="block p-4 text-center text-primary-600 hover:bg-primary-50 transition-colors font-medium"
          >
            Vedi tutte le conversazioni
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Azioni Rapide</h3>
          </div>
          <div className="p-4 space-y-3">
            <Link to="/clients" className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Gestisci Clienti</p>
                <p className="text-sm text-gray-500">Vedi lista clienti</p>
              </div>
            </Link>
            <Link to="/reminders" className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Promemoria Allenamento</p>
                <p className="text-sm text-gray-500">Configura reminder</p>
              </div>
            </Link>
            <Link to="/workouts" className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Genera Scheda</p>
                <p className="text-sm text-gray-500">Crea scheda allenamento</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(date) {
  if (!date) return 'N/A'
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 1) return 'Ora'
  if (minutes < 60) return `${minutes}m fa`
  if (hours < 24) return `${hours}h fa`
  return d.toLocaleDateString('it-IT')
}

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState({ connected: false })
  const { tenant, authFetch } = useAuth()

  // Check WhatsApp status periodically
  useEffect(() => {
    const checkWhatsAppStatus = async () => {
      try {
        const res = await authFetch(`${API_URL}/api/whatsapp/status`)
        if (res.ok) {
          const data = await res.json()
          setWhatsappStatus(data)
        }
      } catch (err) {
        console.log('WhatsApp status check failed')
      }
    }

    checkWhatsAppStatus()
    const interval = setInterval(checkWhatsAppStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} whatsappStatus={whatsappStatus} />

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <button
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{tenant?.name || 'Coach AI'}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<ClientList />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/workouts" element={<WorkoutPlans />} />
            <Route path="/checkin" element={<CheckIn />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="/brain" element={<BrainInsights />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/whatsapp" element={<WhatsAppConnect />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPageWrapper />} />
          <Route path="/register" element={<RegisterPageWrapper />} />
          <Route path="/superadmin" element={<SuperAdmin />} />
          <Route path="/onboarding/:token" element={<OnboardingWizard />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

// Wrapper per redirect se già autenticato
function LoginPageWrapper() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <LoginPage />
}

// Wrapper per la pagina di registrazione
function RegisterPageWrapper() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <RegisterPage />
}

export default App
