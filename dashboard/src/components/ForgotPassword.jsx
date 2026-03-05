import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Dumbbell, Mail, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || ''

function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!email) {
            toast.error('Inserisci la tua email')
            return
        }

        setLoading(true)

        try {
            const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            })

            const data = await res.json()

            if (res.ok) {
                setSuccess(true)
                toast.success(data.message || 'Richiesta inviata')
            } else {
                toast.error(data.error || 'Errore durante la richiesta')
            }
        } catch (err) {
            toast.error('Errore di connessione al server')
        } finally {
            setLoading(false)
        }
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
                    <p className="text-primary-100 mt-2">Recupero Password</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Password dimenticata?</h2>
                    <p className="text-gray-500 text-center mb-6">Inserisci l'indirizzo email associato al tuo account, ti invieremo un link per creare una nuova password.</p>

                    {success ? (
                        <div className="text-center">
                            <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-lg text-green-700 font-medium">
                                Controlla la tua casella di posta elettronica per le istruzioni di reset. Se l'email esiste, riceverai un link a breve.
                            </div>
                            <Link
                                to="/login"
                                className="inline-flex items-center justify-center gap-2 text-primary-600 font-medium hover:text-primary-700"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Torna al Login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="nome@palestra.it"
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Invio in corso...
                                    </>
                                ) : (
                                    'Invia Link Reset'
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
                    )}
                </div>
            </div>
        </div>
    )
}

export default ForgotPassword
