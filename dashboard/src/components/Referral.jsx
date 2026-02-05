import { useState, useEffect } from 'react'
import {
  Gift, Users, Trophy, TrendingUp, Clock,
  CheckCircle, XCircle, UserPlus, Award, Share2
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export default function Referral() {
  const [stats, setStats] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [rewards, setRewards] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [statsRes, referralsRes, leaderboardRes, rewardsRes] = await Promise.all([
        fetch(`${API_URL}/referrals/stats`),
        fetch(`${API_URL}/referrals`),
        fetch(`${API_URL}/referrals/leaderboard`),
        fetch(`${API_URL}/rewards`)
      ])

      setStats(await statsRes.json())
      setReferrals(await referralsRes.json())
      setLeaderboard(await leaderboardRes.json())
      setRewards(await rewardsRes.json())
    } catch (error) {
      console.error('Errore caricamento dati:', error)
    } finally {
      setLoading(false)
    }
  }

  const claimReward = async (rewardId, phone) => {
    try {
      const res = await fetch(`${API_URL}/rewards/${rewardId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      if (res.ok) {
        loadData()
      }
    } catch (error) {
      console.error('Errore riscatto premio:', error)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, text: 'In attesa' },
      registered: { color: 'bg-blue-100 text-blue-800', icon: UserPlus, text: 'Registrato' },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Completato' }
    }
    const badge = badges[status] || badges.pending
    const Icon = badge.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Programma Referral</h1>
        <p className="text-gray-500">Gestisci il programma "Porta un Amico"</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Share2 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.totalReferrals || 0}</p>
              <p className="text-sm text-gray-500">Inviti Totali</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.completed || 0}</p>
              <p className="text-sm text-gray-500">Completati</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.totalReferrers || 0}</p>
              <p className="text-sm text-gray-500">Clienti Attivi</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Gift className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.rewards?.pending || 0}</p>
              <p className="text-sm text-gray-500">Premi da Riscuotere</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-100">
          <nav className="flex gap-4 px-6">
            {[
              { id: 'overview', label: 'Panoramica', icon: TrendingUp },
              { id: 'referrals', label: 'Tutti gli Inviti', icon: Users },
              { id: 'rewards', label: 'Premi', icon: Gift },
              { id: 'leaderboard', label: 'Classifica', icon: Trophy }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Conversion Funnel */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Funnel Conversione</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Codici generati</span>
                    <span className="font-bold">{stats?.totalReferrals || 0}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Registrati</span>
                    <span className="font-bold">{stats?.registered || 0}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${stats?.totalReferrals ? ((stats.registered / stats.totalReferrals) * 100) : 0}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Completati</span>
                    <span className="font-bold">{stats?.completed || 0}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${stats?.totalReferrals ? ((stats.completed / stats.totalReferrals) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                {stats?.totalReferrals > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Tasso di conversione: <span className="font-bold text-green-600">
                        {((stats.completed / stats.totalReferrals) * 100).toFixed(1)}%
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Top Referrers Mini */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Top Referrer</h3>
                {leaderboard.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nessun referral completato ancora
                  </p>
                ) : (
                  <div className="space-y-3">
                    {leaderboard.slice(0, 5).map((user, index) => (
                      <div key={user.phone} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' :
                          index === 1 ? 'bg-gray-400' :
                          index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{user.name || user.phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{user.completed_referrals}</p>
                          <p className="text-xs text-gray-500">inviti</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="md:col-span-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Come funziona il programma</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">1</div>
                    <div>
                      <p className="font-medium">Cliente chiede codice</p>
                      <p className="text-sm text-gray-600">Scrive "invita" o "porta un amico" su WhatsApp</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">2</div>
                    <div>
                      <p className="font-medium">Amico usa il codice</p>
                      <p className="text-sm text-gray-600">Scrive il codice ricevuto in chat</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">3</div>
                    <div>
                      <p className="font-medium">Primo check-in = Premio!</p>
                      <p className="text-sm text-gray-600">Entrambi ricevono un bonus</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Referrals Tab */}
          {activeTab === 'referrals' && (
            <div className="overflow-x-auto">
              {referrals.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Nessun referral ancora</p>
                  <p className="text-sm text-gray-400">I clienti possono generare codici scrivendo "invita" su WhatsApp</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Codice</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Invitante</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Invitato</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Stato</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((referral) => (
                      <tr key={referral.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {referral.referral_code}
                          </code>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{referral.referrer_name || 'Sconosciuto'}</p>
                            <p className="text-xs text-gray-500">{referral.referrer_phone}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {referral.referred_phone ? (
                            <div>
                              <p className="font-medium">{referral.referred_name || 'Nuovo cliente'}</p>
                              <p className="text-xs text-gray-500">{referral.referred_phone}</p>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(referral.status)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {new Date(referral.created_at).toLocaleDateString('it-IT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Rewards Tab */}
          {activeTab === 'rewards' && (
            <div className="overflow-x-auto">
              {rewards.length === 0 ? (
                <div className="text-center py-12">
                  <Gift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Nessun premio generato</p>
                  <p className="text-sm text-gray-400">I premi vengono creati quando un referral viene completato</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Cliente</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Premio</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Stato</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Scadenza</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rewards.map((reward) => (
                      <tr key={reward.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{reward.client_name || 'Sconosciuto'}</p>
                            <p className="text-xs text-gray-500">{reward.phone}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Gift className="w-4 h-4 text-amber-500" />
                            <span>{reward.description}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {reward.claimed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3" />
                              Riscosso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3" />
                              Da riscuotere
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {reward.expires_at
                            ? new Date(reward.expires_at).toLocaleDateString('it-IT')
                            : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {!reward.claimed && (
                            <button
                              onClick={() => claimReward(reward.id, reward.phone)}
                              className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
                            >
                              Segna Riscosso
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div>
              {leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Nessuna classifica ancora</p>
                  <p className="text-sm text-gray-400">La classifica mostra i clienti con referral completati</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaderboard.map((user, index) => (
                    <div
                      key={user.phone}
                      className={`flex items-center gap-4 p-4 rounded-xl ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-200' :
                        index === 1 ? 'bg-gray-50 border border-gray-200' :
                        index === 2 ? 'bg-orange-50 border border-orange-200' :
                        'bg-white border border-gray-100'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-600' :
                        'bg-gray-300'
                      }`}>
                        {index === 0 ? <Trophy className="w-6 h-6" /> : index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{user.name || user.phone}</p>
                        <p className="text-sm text-gray-500">{user.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-green-600">{user.completed_referrals}</p>
                        <p className="text-sm text-gray-500">amici portati</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
