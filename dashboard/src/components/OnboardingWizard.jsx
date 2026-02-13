import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Building2, Smartphone, MessageSquare, Users, Check, ChevronRight,
  ChevronLeft, RefreshCw, Wifi, WifiOff, AlertCircle, Loader2,
  CheckCircle, MapPin, Phone, Clock, Image
} from 'lucide-react'

function OnboardingWizard() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [onboarding, setOnboarding] = useState(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Form data for each step
  const [step1Data, setStep1Data] = useState({
    name: '',
    address: '',
    phone: '',
    hours: '',
    logoUrl: ''
  })

  const [step3Data, setStep3Data] = useState({
    coachName: 'Coach',
    coachTone: 'friendly',
    welcomeMessage: ''
  })

  // WhatsApp status
  const [whatsappStatus, setWhatsappStatus] = useState({ connected: false, qrcode: null })
  const [checkingWhatsApp, setCheckingWhatsApp] = useState(false)

  // Load onboarding data
  useEffect(() => {
    fetchOnboarding()
  }, [token])

  // Poll WhatsApp status when on step 2
  useEffect(() => {
    let interval
    if (currentStep === 2 && !whatsappStatus.connected) {
      checkWhatsAppStatus()
      interval = setInterval(checkWhatsAppStatus, 3000)
    }
    return () => clearInterval(interval)
  }, [currentStep, whatsappStatus.connected])

  const fetchOnboarding = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/onboarding/${token}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Link non valido')
      }
      const data = await res.json()
      setOnboarding(data)
      setCurrentStep(data.currentStep || 1)

      // Pre-fill form data
      if (data.tenant) {
        setStep1Data({
          name: data.tenant.name || '',
          address: data.tenant.gymAddress || '',
          phone: data.tenant.gymPhone || '',
          hours: data.tenant.gymHours || '',
          logoUrl: data.tenant.logoUrl || ''
        })
        setStep3Data({
          coachName: data.tenant.coachName || 'Coach',
          coachTone: data.tenant.coachTone || 'friendly',
          welcomeMessage: data.tenant.welcomeMessage || ''
        })
      }

      // Pre-fill from saved step data
      if (data.stepData?.step1) {
        setStep1Data(prev => ({ ...prev, ...data.stepData.step1 }))
      }
      if (data.stepData?.step3) {
        setStep3Data(prev => ({ ...prev, ...data.stepData.step3 }))
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const checkWhatsAppStatus = async () => {
    setCheckingWhatsApp(true)
    try {
      const res = await fetch(`/api/onboarding/${token}/whatsapp/status`)
      if (res.ok) {
        const data = await res.json()
        setWhatsappStatus(prev => ({ ...prev, connected: data.connected }))
      }
    } catch (err) {
      console.error('WhatsApp status check failed')
    }
    setCheckingWhatsApp(false)
  }

  const getWhatsAppQR = async () => {
    try {
      const res = await fetch(`/api/onboarding/${token}/whatsapp/qrcode`)
      if (res.ok) {
        const data = await res.json()
        setWhatsappStatus(data)
      }
    } catch (err) {
      console.error('QR code fetch failed')
    }
  }

  const saveStep = async (stepNum, data) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/onboarding/${token}/step/${stepNum}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Errore salvataggio')
      }
      return true
    } catch (err) {
      alert('Errore: ' + err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const nextStep = async () => {
    // Save current step data
    if (currentStep === 1) {
      const success = await saveStep(1, step1Data)
      if (!success) return
    } else if (currentStep === 3) {
      const success = await saveStep(3, step3Data)
      if (!success) return
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
      if (currentStep + 1 === 2) {
        getWhatsAppQR()
      }
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const completeOnboarding = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/onboarding/${token}/complete`, {
        method: 'POST'
      })
      if (res.ok) {
        setCurrentStep(5) // Show completion screen
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Errore completamento')
      }
    } catch (err) {
      alert('Errore: ' + err.message)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            Se il link e scaduto, contatta il supporto per riceverne uno nuovo.
          </p>
        </div>
      </div>
    )
  }

  // Completion screen
  if (currentStep === 5) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Configurazione Completata!</h1>
          <p className="text-gray-600 mb-6">
            La tua palestra <strong>{step1Data.name}</strong> e pronta per utilizzare Coach AI.
          </p>
          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-700">
              I tuoi clienti possono ora chattare con il tuo coach virtuale su WhatsApp!
            </p>
          </div>
          <p className="text-sm text-gray-500">
            Riceverai un'email con le istruzioni per accedere alla dashboard.
          </p>
        </div>
      </div>
    )
  }

  const steps = [
    { num: 1, title: 'Info Palestra', icon: Building2 },
    { num: 2, title: 'WhatsApp', icon: Smartphone },
    { num: 3, title: 'Coach AI', icon: MessageSquare },
    { num: 4, title: 'Conferma', icon: Check }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Coach AI</h1>
              <p className="text-sm text-gray-500">Configurazione palestra</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <React.Fragment key={step.num}>
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  currentStep >= step.num
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {currentStep > step.num ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <step.icon className="w-6 h-6" />
                  )}
                </div>
                <p className={`text-xs mt-2 font-medium ${
                  currentStep >= step.num ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 rounded ${
                  currentStep > step.num ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {/* STEP 1: Gym Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Informazioni Palestra</h2>
                <p className="text-gray-600">Inserisci i dati della tua palestra</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Palestra *
                  </label>
                  <input
                    type="text"
                    value={step1Data.name}
                    onChange={(e) => setStep1Data(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Es. Fitness Club Roma"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Indirizzo
                  </label>
                  <input
                    type="text"
                    value={step1Data.address}
                    onChange={(e) => setStep1Data(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Via Roma 123, 00100 Roma"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Phone className="w-4 h-4 inline mr-1" />
                      Telefono
                    </label>
                    <input
                      type="tel"
                      value={step1Data.phone}
                      onChange={(e) => setStep1Data(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="06 1234567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Orari
                    </label>
                    <input
                      type="text"
                      value={step1Data.hours}
                      onChange={(e) => setStep1Data(prev => ({ ...prev, hours: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Lun-Ven 7-22"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: WhatsApp Connection */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Connetti WhatsApp</h2>
                <p className="text-gray-600">Collega il numero WhatsApp della palestra</p>
              </div>

              {whatsappStatus.connected ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wifi className="w-10 h-10 text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-green-600 mb-2">WhatsApp Connesso!</h3>
                  <p className="text-gray-600">Il tuo numero WhatsApp e stato collegato con successo.</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="bg-gray-50 rounded-xl p-6 mb-4">
                    {whatsappStatus.qrcode ? (
                      <img
                        src={whatsappStatus.qrcode}
                        alt="QR Code WhatsApp"
                        className="w-64 h-64 mx-auto"
                      />
                    ) : (
                      <div className="w-64 h-64 mx-auto flex items-center justify-center bg-gray-100 rounded-lg">
                        <button
                          onClick={getWhatsAppQR}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          <RefreshCw className="w-5 h-5" />
                          Carica QR Code
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-left bg-blue-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-blue-800 mb-2">Come collegare WhatsApp:</h4>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                      <li>Apri WhatsApp sul telefono della palestra</li>
                      <li>Vai in Impostazioni &gt; Dispositivi collegati</li>
                      <li>Clicca su "Collega un dispositivo"</li>
                      <li>Scansiona il QR code qui sopra</li>
                    </ol>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    {checkingWhatsApp && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span className="text-sm">In attesa della connessione...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Coach Customization */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Personalizza il Coach</h2>
                <p className="text-gray-600">Configura il tuo assistente virtuale</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome del Coach
                  </label>
                  <input
                    type="text"
                    value={step3Data.coachName}
                    onChange={(e) => setStep3Data(prev => ({ ...prev, coachName: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Es. Marco, Coach Fit, Alex"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Come si presentera ai tuoi clienti
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tono di Voce
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'formal', label: 'Formale', desc: 'Professionale e rispettoso' },
                      { value: 'friendly', label: 'Amichevole', desc: 'Caldo e accogliente' },
                      { value: 'motivational', label: 'Motivazionale', desc: 'Energico e stimolante' }
                    ].map(tone => (
                      <button
                        key={tone.value}
                        type="button"
                        onClick={() => setStep3Data(prev => ({ ...prev, coachTone: tone.value }))}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          step3Data.coachTone === tone.value
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-medium text-gray-900">{tone.label}</p>
                        <p className="text-xs text-gray-500 mt-1">{tone.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Messaggio di Benvenuto (opzionale)
                  </label>
                  <textarea
                    value={step3Data.welcomeMessage}
                    onChange={(e) => setStep3Data(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Ciao! Sono il tuo coach virtuale. Come posso aiutarti oggi?"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Confirmation */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Conferma Configurazione</h2>
                <p className="text-gray-600">Verifica i dati prima di completare</p>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-green-500" />
                    Palestra
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Nome</p>
                      <p className="font-medium">{step1Data.name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Indirizzo</p>
                      <p className="font-medium">{step1Data.address || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Telefono</p>
                      <p className="font-medium">{step1Data.phone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Orari</p>
                      <p className="font-medium">{step1Data.hours || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-green-500" />
                    WhatsApp
                  </h4>
                  <div className={`flex items-center gap-2 ${whatsappStatus.connected ? 'text-green-600' : 'text-orange-600'}`}>
                    {whatsappStatus.connected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                    <span className="font-medium">
                      {whatsappStatus.connected ? 'Connesso' : 'Non connesso'}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-green-500" />
                    Coach AI
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Nome Coach</p>
                      <p className="font-medium">{step3Data.coachName || 'Coach'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Tono</p>
                      <p className="font-medium capitalize">{step3Data.coachTone}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Cliccando "Completa" la tua palestra sara attivata e potrai iniziare ad usare Coach AI!
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
              Indietro
            </button>

            {currentStep < 4 ? (
              <button
                onClick={nextStep}
                disabled={saving || (currentStep === 1 && !step1Data.name)}
                className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    Continua
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={completeOnboarding}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Completamento...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Completa
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
