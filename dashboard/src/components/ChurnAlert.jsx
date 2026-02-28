import React, { useState, useEffect } from 'react';
import { AlertTriangle, Send, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ChurnAlert() {
    const { authFetch } = useAuth();
    const [atRiskClients, setAtRiskClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actioningPhone, setActioningPhone] = useState(null);
    const [successPhones, setSuccessPhones] = useState([]);

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            setLoading(true);
            const res = await authFetch(`${API_URL}/api/clients`);
            if (res.ok) {
                const data = await res.json();
                // Filtriamo i clienti a rischio:
                // Criterio 1: inattivi da più di 14 giorni
                // Criterio 2: churnRisk calcolato >= 0.70
                const atRisk = data.filter(client =>
                    (client.daysSinceLastCheckin !== null && client.daysSinceLastCheckin >= 14) ||
                    (client.churnRisk !== null && client.churnRisk >= 0.7)
                );
                // Ordiniamo per i più critici (giorni di inattività o rischio)
                atRisk.sort((a, b) => {
                    if (a.daysSinceLastCheckin && b.daysSinceLastCheckin) {
                        return b.daysSinceLastCheckin - a.daysSinceLastCheckin;
                    }
                    return (b.churnRisk || 0) - (a.churnRisk || 0);
                });

                setAtRiskClients(atRisk);
            }
        } catch (err) {
            console.error('Failed to fetch clients for churn alert', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReengage = async (phone) => {
        if (actioningPhone) return; // Prevent double clicks

        setActioningPhone(phone);
        try {
            const res = await authFetch(`${API_URL}/api/brain/reengage/${phone}`, {
                method: 'POST'
            });

            if (res.ok) {
                setSuccessPhones(prev => [...prev, phone]);
            } else {
                const data = await res.json();
                alert(`Errore: ${data.error || 'Impossibile inviare il messaggio'}`);
            }
        } catch (err) {
            console.error('Error triggering reengage API', err);
            alert('Errore di rete durante la richiesta.');
        } finally {
            setActioningPhone(null);
        }
    };

    if (loading) {
        return (
            <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex justify-center items-center">
                <RefreshCw className="w-6 h-6 text-red-300 animate-spin" />
            </div>
        );
    }

    if (atRiskClients.length === 0) {
        return (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-green-900">
                        Nessun cliente a rischio! 🎉
                    </h3>
                    <p className="text-green-700 text-sm mt-1">
                        Ottimo lavoro. Tutti i tuoi clienti si stanno allenando regolarmente e nessuno manca da più di 14 giorni.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-red-900">
                        Attenzione: {atRiskClients.length} {atRiskClients.length === 1 ? 'cliente a rischio' : 'clienti a rischio'} di abbandono
                    </h3>
                    <p className="text-red-700 text-sm mt-1">
                        Reagisci subito. I seguenti clienti non si allenano da oltre due settimane o mostrano pattern di abbandono. Il Brain AI è pronto a recuperarli.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
                {atRiskClients.map((client) => {
                    const isSuccess = successPhones.includes(client.phone);
                    const isActioning = actioningPhone === client.phone;

                    return (
                        <div key={client.phone} className="bg-white rounded-lg p-4 border border-red-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-gray-900">{client.name}</h4>
                                    {client.churnRisk >= 0.8 && (
                                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                                            Critico
                                        </span>
                                    )}
                                </div>

                                <div className="mt-2 text-sm text-gray-600 space-y-1">
                                    {client.daysSinceLastCheckin ? (
                                        <p>Inattivo da: <span className="font-semibold text-red-600">{client.daysSinceLastCheckin} giorni</span></p>
                                    ) : (
                                        <p>Rischio AI: <span className="font-semibold text-orange-500">{Math.round((client.churnRisk || 0) * 100)}%</span></p>
                                    )}
                                    {client.objective && <p className="truncate">Obiettivo: {client.objective}</p>}
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100">
                                {isSuccess ? (
                                    <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 py-2 rounded-lg font-medium text-sm">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Messaggio inviato</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleReengage(client.phone)}
                                        disabled={isActioning}
                                        className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-all ${isActioning
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md'
                                            }`}
                                    >
                                        {isActioning ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                <span>Richiama tramite AI</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
