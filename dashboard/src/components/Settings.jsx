import React, { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon, Bot, Save, RotateCcw,
  Eye, Sparkles, Building2, User, MessageSquare,
  CheckCircle, AlertCircle, Loader2
} from 'lucide-react'

export default function Settings() {
  const [aiConfig, setAiConfig] = useState({
    gymName: '',
    coachName: '',
    personality: '',
    useEmoji: true,
    systemPrompt: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/ai/config')
      if (res.ok) {
        const data = await res.json()
        setAiConfig(data)
      }
    } catch (err) {
      console.error('Errore caricamento config:', err)
      setMessage({ type: 'error', text: 'Errore nel caricamento della configurazione' })
    } finally {
      setLoading(false)
    }
  }

  const fetchPreview = async () => {
    try {
      const res = await fetch('/api/ai/preview')
      if (res.ok) {
        const data = await res.json()
        setPreview(data.prompt)
        setShowPreview(true)
      }
    } catch (err) {
      console.error('Errore preview:', err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfig)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Configurazione salvata con successo!' })
        setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      } else {
        throw new Error('Errore salvataggio')
      }
    } catch (err) {
      console.error('Errore salvataggio:', err)
      setMessage({ type: 'error', text: 'Errore nel salvataggio della configurazione' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!window.confirm('Sei sicuro di voler ripristinare le impostazioni predefinite?')) return

    setSaving(true)
    try {
      const res = await fetch('/api/ai/reset', {
        method: 'POST'
      })
      if (res.ok) {
        const data = await res.json()
        setAiConfig(data.config)
        setMessage({ type: 'success', text: 'Configurazione ripristinata!' })
        setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      }
    } catch (err) {
      console.error('Errore reset:', err)
      setMessage({ type: 'error', text: 'Errore nel ripristino' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Impostazioni</h2>
          <p className="text-gray-500">Personalizza il comportamento del Coach AI</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Ripristina
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salva
          </button>
        </div>
      </div>

      {/* Status message */}
      {message.text && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Connessione WhatsApp */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Connessione WhatsApp</h3>
            <p className="text-sm text-gray-500">Stato della connessione Evolution API</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-700 font-medium">Connesso</span>
          <span className="text-gray-500">+39 351 956 6388</span>
        </div>
      </div>

      {/* Identita Coach */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Identita Coach</h3>
            <p className="text-sm text-gray-500">Personalizza nome e palestra</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4" />
              Nome del Coach
            </label>
            <input
              type="text"
              value={aiConfig.coachName}
              onChange={(e) => setAiConfig({ ...aiConfig, coachName: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Coach AI"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Building2 className="w-4 h-4" />
              Nome Palestra
            </label>
            <input
              type="text"
              value={aiConfig.gymName}
              onChange={(e) => setAiConfig({ ...aiConfig, gymName: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Centro Fitness Amati"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Sparkles className="w-4 h-4" />
            Personalita
          </label>
          <input
            type="text"
            value={aiConfig.personality}
            onChange={(e) => setAiConfig({ ...aiConfig, personality: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="amichevole e motivante"
          />
          <p className="text-xs text-gray-500 mt-1">Descrivi brevemente lo stile di comunicazione</p>
        </div>

        <div className="mt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={aiConfig.useEmoji}
              onChange={(e) => setAiConfig({ ...aiConfig, useEmoji: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700">Usa emoji nelle risposte</span>
          </label>
        </div>
      </div>

      {/* System Prompt */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Prompt di Sistema</h3>
              <p className="text-sm text-gray-500">Istruzioni complete per il comportamento dell'AI</p>
            </div>
          </div>
          <button
            onClick={fetchPreview}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Anteprima
          </button>
        </div>

        <textarea
          value={aiConfig.systemPrompt}
          onChange={(e) => setAiConfig({ ...aiConfig, systemPrompt: e.target.value })}
          className="w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
          rows={16}
          placeholder="Inserisci il prompt di sistema..."
        />
        <p className="text-xs text-gray-500 mt-2">
          Usa "Coach AI" e "una palestra" come placeholder - verranno sostituiti automaticamente con i nomi configurati sopra.
        </p>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Anteprima Prompt Finale</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                {preview}
              </pre>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 mb-2">Come funziona</h4>
        <ul className="text-sm text-blue-700 space-y-2">
          <li>• Il <strong>Nome Coach</strong> e il <strong>Nome Palestra</strong> vengono automaticamente inseriti nel prompt</li>
          <li>• Disattivando le <strong>emoji</strong>, il coach non le utilizzera nelle risposte</li>
          <li>• Il <strong>prompt di sistema</strong> definisce la personalita e il comportamento completo del coach</li>
          <li>• Usa <strong>Anteprima</strong> per vedere il prompt finale che viene inviato all'AI</li>
          <li>• Le modifiche sono applicate immediatamente ai nuovi messaggi</li>
        </ul>
      </div>
    </div>
  )
}
