import React, { useState, useEffect } from 'react'
import {
  Brain, Save, RotateCcw, CheckCircle, AlertCircle, Loader2,
  Clock, MessageSquare, Shield, Sliders, Zap, Moon,
  ChevronDown, ChevronUp, Info
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || ''

// Valori di default (specchio del backend)
const DEFAULTS = {
  brain_enabled: true,
  max_messages_per_day: 10,
  max_messages_per_client_per_week: 3,
  min_hours_between_messages: 24,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  churn_threshold_high: 0.70,
  churn_threshold_medium: 0.50,
  inactivity_days_high: 5,
  inactivity_days_support_max: 7,
  streak_recovery_min_days: 2,
  streak_recovery_max_days: 5,
  engagement_threshold: 0.60,
  consistency_threshold_progress: 0.50,
  consistency_threshold_streak: 0.70,
  min_checkins_for_progress: 8,
  check_progress_interval_days: 14,
  delay_between_messages_ms: 3000
}

export default function BrainSettings({ embedded = false }) {
  const { authFetch } = useAuth()
  const [settings, setSettings] = useState({ ...DEFAULTS })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [expandedSections, setExpandedSections] = useState({
    frequency: true,
    quiet: true,
    thresholds: false,
    advanced: false
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/brain/settings`)
      if (res.ok) {
        const data = await res.json()
        setSettings(prev => ({ ...prev, ...data }))
      }
    } catch (err) {
      console.error('Errore caricamento settings:', err)
      setMessage({ type: 'error', text: 'Errore nel caricamento delle impostazioni' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const res = await authFetch(`${API_URL}/api/brain/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      if (res.ok) {
        const data = await res.json()
        setSettings(prev => ({ ...prev, ...data }))
        setMessage({ type: 'success', text: 'Impostazioni salvate con successo!' })
      } else {
        throw new Error('Errore nel salvataggio')
      }
    } catch (err) {
      console.error('Errore salvataggio settings:', err)
      setMessage({ type: 'error', text: 'Errore nel salvataggio delle impostazioni' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage({ type: '', text: '' }), 4000)
    }
  }

  const handleReset = () => {
    setSettings({ ...DEFAULTS })
    setMessage({ type: 'info', text: 'Valori ripristinati ai default. Clicca "Salva" per confermare.' })
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        <span className="ml-3 text-gray-500">Caricamento impostazioni...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - solo se non embedded */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="w-7 h-7 text-purple-600" />
              Impostazioni Brain AI
            </h1>
            <p className="text-gray-500 mt-1">Configura la frequenza e il comportamento dei messaggi automatici</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Default
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salva'}
            </button>
          </div>
        </div>
      )}

      {/* Status Message */}
      {message.text && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
           message.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
           <Info className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* ON/OFF Toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${settings.brain_enabled ? 'bg-purple-100' : 'bg-gray-100'}`}>
              <Zap className={`w-6 h-6 ${settings.brain_enabled ? 'text-purple-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Brain AI Attivo</h3>
              <p className="text-sm text-gray-500">
                {settings.brain_enabled
                  ? 'Il Brain invia messaggi automatici ai tuoi clienti'
                  : 'Il Brain è disattivato. Nessun messaggio automatico verrà inviato'}
              </p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('brain_enabled', !settings.brain_enabled)}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
              settings.brain_enabled ? 'bg-purple-600' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow ${
              settings.brain_enabled ? 'translate-x-8' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Sezione 1: Frequenza Messaggi */}
      <CollapsibleSection
        title="Frequenza Messaggi"
        subtitle="Controlla quanti messaggi inviare"
        icon={<MessageSquare className="w-5 h-5 text-blue-600" />}
        expanded={expandedSections.frequency}
        onToggle={() => toggleSection('frequency')}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumberInput
            label="Max messaggi al giorno"
            description="Tetto massimo giornaliero per la tua palestra"
            value={settings.max_messages_per_day}
            onChange={v => updateSetting('max_messages_per_day', v)}
            min={1} max={50}
            unit="msg/giorno"
          />
          <NumberInput
            label="Max per cliente a settimana"
            description="Quanti messaggi max per singolo cliente"
            value={settings.max_messages_per_client_per_week}
            onChange={v => updateSetting('max_messages_per_client_per_week', v)}
            min={1} max={14}
            unit="msg/settimana"
          />
          <NumberInput
            label="Ore minime tra messaggi"
            description="Distanza minima tra 2 messaggi allo stesso cliente"
            value={settings.min_hours_between_messages}
            onChange={v => updateSetting('min_hours_between_messages', v)}
            min={1} max={168}
            unit="ore"
          />
        </div>
      </CollapsibleSection>

      {/* Sezione 2: Orari Silenziosi */}
      <CollapsibleSection
        title="Orari Silenziosi"
        subtitle="Nessun messaggio in questi orari"
        icon={<Moon className="w-5 h-5 text-indigo-600" />}
        expanded={expandedSections.quiet}
        onToggle={() => toggleSection('quiet')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TimeInput
            label="Inizio silenzio"
            description="Da quest'ora nessun messaggio"
            value={settings.quiet_hours_start}
            onChange={v => updateSetting('quiet_hours_start', v)}
          />
          <TimeInput
            label="Fine silenzio"
            description="I messaggi riprendono da quest'ora"
            value={settings.quiet_hours_end}
            onChange={v => updateSetting('quiet_hours_end', v)}
          />
        </div>
        <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
          <p className="text-sm text-indigo-700">
            <Clock className="w-4 h-4 inline mr-1" />
            Attualmente: niente messaggi dalle <strong>{settings.quiet_hours_start}</strong> alle <strong>{settings.quiet_hours_end}</strong>
          </p>
        </div>
      </CollapsibleSection>

      {/* Sezione 3: Soglie Decisione */}
      <CollapsibleSection
        title="Soglie di Decisione"
        subtitle="Quando il Brain decide di intervenire"
        icon={<Sliders className="w-5 h-5 text-orange-600" />}
        expanded={expandedSections.thresholds}
        onToggle={() => toggleSection('thresholds')}
      >
        <div className="space-y-6">
          {/* Churn Risk */}
          <div>
            <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-500" />
              Rischio Churn
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SliderInput
                label="Soglia Alta (Comeback)"
                description="Sopra questa soglia: messaggio di ritorno"
                value={settings.churn_threshold_high}
                onChange={v => updateSetting('churn_threshold_high', v)}
                min={0.3} max={1.0} step={0.05}
                color="red"
              />
              <SliderInput
                label="Soglia Media (Motivazione)"
                description="Sopra questa soglia + trend in calo: motivazionale"
                value={settings.churn_threshold_medium}
                onChange={v => updateSetting('churn_threshold_medium', v)}
                min={0.2} max={0.9} step={0.05}
                color="orange"
              />
            </div>
          </div>

          {/* Inattivita' */}
          <div>
            <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              Inattivita'
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <NumberInput
                label="Giorni per Comeback"
                description="Giorni senza check-in per attivare comeback"
                value={settings.inactivity_days_high}
                onChange={v => updateSetting('inactivity_days_high', v)}
                min={2} max={30}
                unit="giorni"
              />
              <NumberInput
                label="Max giorni per Supporto"
                description="Entro quanti giorni inviare supporto (motivazione bassa)"
                value={settings.inactivity_days_support_max}
                onChange={v => updateSetting('inactivity_days_support_max', v)}
                min={3} max={30}
                unit="giorni"
              />
            </div>
          </div>

          {/* Streak Recovery */}
          <div>
            <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-500" />
              Recupero Streak
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <NumberInput
                label="Min giorni assenza"
                description="Minimo giorni di assenza per streak recovery"
                value={settings.streak_recovery_min_days}
                onChange={v => updateSetting('streak_recovery_min_days', v)}
                min={1} max={10}
                unit="giorni"
              />
              <NumberInput
                label="Max giorni assenza"
                description="Massimo giorni per considerare una streak recovery"
                value={settings.streak_recovery_max_days}
                onChange={v => updateSetting('streak_recovery_max_days', v)}
                min={2} max={14}
                unit="giorni"
              />
            </div>
          </div>

          {/* Engagement */}
          <div>
            <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-500" />
              Engagement & Consistency
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SliderInput
                label="Soglia Engagement"
                description="Per check progress"
                value={settings.engagement_threshold}
                onChange={v => updateSetting('engagement_threshold', v)}
                min={0.2} max={1.0} step={0.05}
                color="purple"
              />
              <SliderInput
                label="Consistency (Progress)"
                description="Per check progress"
                value={settings.consistency_threshold_progress}
                onChange={v => updateSetting('consistency_threshold_progress', v)}
                min={0.2} max={1.0} step={0.05}
                color="blue"
              />
              <SliderInput
                label="Consistency (Streak)"
                description="Per streak recovery"
                value={settings.consistency_threshold_streak}
                onChange={v => updateSetting('consistency_threshold_streak', v)}
                min={0.3} max={1.0} step={0.05}
                color="green"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Sezione 4: Avanzate */}
      <CollapsibleSection
        title="Impostazioni Avanzate"
        subtitle="Parametri tecnici del sistema"
        icon={<Sliders className="w-5 h-5 text-gray-600" />}
        expanded={expandedSections.advanced}
        onToggle={() => toggleSection('advanced')}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumberInput
            label="Min check-in per progress"
            description="Quanti check-in/30gg per chiedere feedback"
            value={settings.min_checkins_for_progress}
            onChange={v => updateSetting('min_checkins_for_progress', v)}
            min={3} max={30}
            unit="check-in"
          />
          <NumberInput
            label="Intervallo check progress"
            description="Giorni minimo tra richieste feedback"
            value={settings.check_progress_interval_days}
            onChange={v => updateSetting('check_progress_interval_days', v)}
            min={7} max={60}
            unit="giorni"
          />
          <NumberInput
            label="Delay tra messaggi"
            description="Pausa tra un invio e l'altro (ms)"
            value={settings.delay_between_messages_ms}
            onChange={v => updateSetting('delay_between_messages_ms', v)}
            min={1000} max={10000}
            unit="ms"
          />
        </div>
      </CollapsibleSection>

      {/* Bottoni Salva/Reset quando embedded */}
      {embedded && (
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salva'}
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
          <div className="text-sm text-purple-700">
            <p className="font-medium mb-1">Come funziona il Brain AI</p>
            <p>
              Il Brain analizza i pattern di allenamento dei tuoi clienti ogni 6 ore e invia messaggi personalizzati
              via WhatsApp quando rileva situazioni importanti (rischio abbandono, calo di motivazione, streak interrotta, ecc.).
              Ogni messaggio viene generato dall'AI in modo unico e personalizzato.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ Sub-Components ============

function CollapsibleSection({ title, subtitle, icon, expanded, onToggle, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">{icon}</div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-4">
          {children}
        </div>
      )}
    </div>
  )
}

function NumberInput({ label, description, value, onChange, min, max, unit }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={e => {
            const v = parseInt(e.target.value)
            if (!isNaN(v) && v >= min && v <= max) onChange(v)
          }}
          min={min}
          max={max}
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
    </div>
  )
}

function TimeInput({ label, description, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
    </div>
  )
}

function SliderInput({ label, description, value, onChange, min, max, step, color }) {
  const percentage = Math.round(parseFloat(value) * 100)

  const colorClasses = {
    red: 'accent-red-500',
    orange: 'accent-orange-500',
    purple: 'accent-purple-500',
    blue: 'accent-blue-500',
    green: 'accent-green-500'
  }

  const badgeColors = {
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${badgeColors[color] || 'bg-gray-100 text-gray-700'}`}>
          {percentage}%
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <input
        type="range"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        className={`w-full h-2 rounded-lg cursor-pointer ${colorClasses[color] || ''}`}
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{Math.round(min * 100)}%</span>
        <span>{Math.round(max * 100)}%</span>
      </div>
    </div>
  )
}
