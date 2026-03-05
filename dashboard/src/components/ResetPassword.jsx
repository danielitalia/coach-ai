import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Dumbbell, Lock, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || ''

function ResetPassword() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [token, setToken] = useState(null)
    const [invalidToken, setInvalidToken] = useState(false)

    const location = useLocation()
    const navigate = useNavigate()

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const tokenParam = params.get('token')
        if (tokenParam) {
            setToken(tokenParam)
        } else {
            setInvalidToken(true)
        }
    }, [location])

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!token) {
            toast.error('Token mancante')
            return
        }

        if (password.length < 8) {
            toast.error('La password deve avere almeno 8 caratteri')
            return
        }

        if (password !== confirmPassword) {
            toast.error('Le password non coincidono')
            return
        }

        setLoading(true)

        try {
            const res = await fetch(`${API_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token, password })
            })

            const data = await res.json()

            if (res.ok) {
                toast.success(data.message || 'Password aggiornata con successo!')
                setTimeout(() => {
                    navigate('/login')
                }, 2000)
            } else {
                toast.error(data.error || 'Errore durante l\'aggiornamento della password')
            }
        } catch (err) {
            toast.error('Errore di connessione al server')
        } finally {
            setLoading(false)
        }
    }

    if (invalidToken) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Non Valido</h2>
                    <p className="text-gray-500 mb-6">Il link per il recupero password non è valido o è scaduto. Riprova a richiedere il reset.</p>
                    <Link
                        to="/forgot-password"
                        className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors inline-block"
                    >
                        Nuova Richiesta
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
                        <Dumbbell className="w-8 h-8 text-primary-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Coach AI</h1>
                    <p className="text-primary-100 mt-2">Reimposta Password</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Nuova Password</h2>
                    <p className="text-gray-500 text-center mb-6">Inserisci la tua nuova password qui sotto.</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nuova Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Minimo 8 caratteri</p>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Conferma Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                    required
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Salvataggio...
                                </>
                            ) : (
                                'Salva Nuova Password'
                            )}
                        </button>
                        <div className="text-center mt-6">
                            <Link
                                to="/login"
                                className="inline-flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Torna al Login
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default ResetPassword
