import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

function ReloadPrompt() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered:', r)
        },
        onRegisterError(error) {
            console.log('SW registration error', error)
        },
    })

    const close = () => {
        setOfflineReady(false)
        setNeedRefresh(false)
    }

    if (!offlineReady && !needRefresh) return null

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom pt-5">
            <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-4 max-w-sm flex flex-col gap-3 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-50 rounded-full opacity-50 pointer-events-none"></div>

                <button
                    onClick={close}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    aria-label="Chiudi"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3 relative">
                    <div className="bg-primary-50 p-2 rounded-lg text-primary-600 shrink-0 mt-0.5">
                        <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">
                            {offlineReady ? 'App pronta offline' : 'Nuovo Aggiornamento'}
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed mb-3">
                            {offlineReady
                                ? 'Coach AI è stato scaricato e può funzionare anche senza connessione.'
                                : 'È disponibile una nuova versione con funzionalità o correzioni. Ricarica per applicarla.'}
                        </p>

                        {needRefresh && (
                            <button
                                className="w-full bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                                onClick={() => updateServiceWorker(true)}
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Aggiorna Ora
                            </button>
                        )}
                        {offlineReady && (
                            <button
                                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 px-4 rounded-lg transition-all active:scale-95"
                                onClick={close}
                            >
                                Ho capito
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ReloadPrompt
