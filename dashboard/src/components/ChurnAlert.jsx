import React, { useState, useEffect } from 'react';
import { AlertTriangle, Send, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ChurnAlert() {
    const { authFetch } = useAuth();
    const [atRiskClients, setAtRiskClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actioningPhone, setActioningPhone] = useState(null);
    const [successPhones, setSuccessPhones] = useState([]);
    const [errorMsg, setErrorMsg] = useState(null);

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
                setErrorMsg(null);
            } else {
                const data = await res.json();
                setErrorMsg(data.error || 'Impossibile inviare il messaggio');
            }
        } catch (err) {
            console.error('Error triggering reengage API', err);
            setErrorMsg('Errore di rete durante la richiesta.');
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
        <div className="bg-[#fdf2f0] -mx-4 lg:-mx-8 px-4 lg:px-8 py-6 mb-8 mt-2 lg:mt-0 lg:border-t-0 shadow-sm border-b border-[#fcecec]">
            <div className="flex items-start gap-3 mb-6">
                <AlertTriangle className="w-6 h-6 text-[#d32f2f] flex-shrink-0 mt-0.5" />
                <div>
                    <h3 className="text-lg font-bold text-[#8c1d18] tracking-tight">
                        Attenzione: {atRiskClients.length} {atRiskClients.length === 1 ? 'cliente a rischio' : 'clienti a rischio'} di abbandono
                    </h3>
                    <p className="text-[#d32f2f] text-sm mt-1">
                        Reagisci subito. I seguenti clienti non si allenano da oltre due settimane o mostrano pattern di abbandono. Il Brain AI è pronto a recuperarli.
                    </p>
                </div>
            </div>

            {errorMsg && (
                <div className="mb-4 p-3 bg-white border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                    <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {atRiskClients.map((client) => {
                    const isSuccess = successPhones.includes(client.phone);
                    const isActioning = actioningPhone === client.phone;

                    return (
                        <div key={client.phone} className="bg-white rounded-xl p-5 shadow-sm flex flex-col justify-between h-full border-0">
                            <div className="mb-4">
                                {client.name ? (
                                    <>
                                        <div className="flex justify-between items-start w-full mb-2 min-h-[24px]">
                                            <h4 className="font-bold text-gray-900 text-[15px] leading-tight break-words pr-2">
                                                {client.name}
                                            </h4>
                                            {client.churnRisk >= 0.8 && (
                                                <span className="px-2 py-0.5 bg-[#fdf2f0] text-[#d32f2f] text-[11px] font-bold rounded-md shrink-0 uppercase tracking-wide">
                                                    Critico
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[13px] text-gray-700 flex-1 flex flex-col">
                                            {client.daysSinceLastCheckin === 999 ? (
                                                <p>Stato: <span className="font-bold text-[#d32f2f]">Mai allenato</span></p>
                                            ) : client.daysSinceLastCheckin ? (
                                                <p>Inattivo da: <span className="font-bold text-[#d32f2f]">{client.daysSinceLastCheckin} giorni</span></p>
                                            ) : (
                                                <p>Rischio AI: <span className="font-bold text-[#d32f2f]">{Math.round((client.churnRisk || 0) * 100)}%</span></p>
                                            )}
                                            <p className="text-gray-500 pt-1 min-h-[20px]">
                                                {client.objective ? `Obiettivo: ${client.objective}` : '\u00A0'}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start w-full mb-2 min-h-[24px]">
                                            <h4 className="font-bold text-transparent text-[15px] leading-tight select-none">
                                                NessunNome
                                            </h4>
                                            {client.churnRisk >= 0.8 && (
                                                <span className="px-2 py-0.5 bg-[#fdf2f0] text-[#d32f2f] text-[11px] font-bold rounded-md shrink-0 uppercase tracking-wide">
                                                    Critico
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[13px] text-gray-700 flex-1 flex flex-col">
                                            {client.daysSinceLastCheckin === 999 ? (
                                                <p>Stato: <span className="font-bold text-[#d32f2f]">Mai allenato</span></p>
                                            ) : client.daysSinceLastCheckin ? (
                                                <p>Inattivo da: <span className="font-bold text-[#d32f2f]">{client.daysSinceLastCheckin} giorni</span></p>
                                            ) : (
                                                <p>Rischio AI: <span className="font-bold text-[#d32f2f]">{Math.round((client.churnRisk || 0) * 100)}%</span></p>
                                            )}
                                            <p className="text-gray-500 pt-1 min-h-[20px]">
                                                {'\u00A0'}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="mt-auto">
                                {isSuccess ? (
                                    <div className="flex items-center justify-center gap-2 text-white bg-green-500 py-2.5 px-4 rounded-lg font-semibold text-sm shadow-sm transition-all focus:outline-none">
                                        <CheckCircle2 className="w-5 h-5" />
                                        <span>Messaggio inviato</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleReengage(client.phone)}
                                        disabled={isActioning}
                                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${isActioning
                                            ? 'bg-red-300 text-white cursor-not-allowed'
                                            : 'bg-[#d32f2f] hover:bg-[#b71c1c] text-white shadow-sm'
                                            }`}
                                    >
                                        {isActioning ? (
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4 ml-[-4px]" />
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
