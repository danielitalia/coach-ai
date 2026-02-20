import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Dumbbell, MessageSquare, Brain, BarChart3,
  Smartphone, Zap, Users, CheckCircle, ChevronDown,
  ArrowRight, Shield, Clock, Menu, X,
  Bot, UserX, TrendingDown, QrCode
} from 'lucide-react'

const scrollToSection = (id) => {
  const el = document.getElementById(id)
  if (el) {
    const y = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top: y, behavior: 'smooth' })
  }
}

// ==================== DATA ====================

const problems = [
  {
    icon: UserX,
    title: 'Clienti fantasma',
    desc: 'Si iscrivono motivati, vengono 2 settimane, poi spariscono. Te ne accorgi solo quando non rinnovano.',
  },
  {
    icon: Clock,
    title: 'Zero follow-up',
    desc: 'I tuoi trainer non riescono a seguire ogni cliente fuori dalla palestra. Nessuno li contatta tra una sessione e l\'altra.',
  },
  {
    icon: TrendingDown,
    title: 'Revenue persa',
    desc: 'Ogni cliente perso sono centinaia di euro all\'anno. Acquisirne uno nuovo costa 5 volte di più che trattenerne uno.',
  },
]

const features = [
  {
    icon: MessageSquare,
    title: 'Chat Intelligente',
    desc: 'I tuoi clienti scrivono su WhatsApp come farebbero con un amico. L\'AI capisce il contesto e risponde in modo naturale.',
    span: true,
  },
  {
    icon: Dumbbell,
    title: 'Schede Personalizzate',
    desc: 'Genera schede di allenamento via chat, basate su obiettivi, livello e infortuni del cliente.',
  },
  {
    icon: Brain,
    title: 'Rilevamento Abbandono',
    desc: 'L\'algoritmo predittivo analizza comportamento e interazioni per individuare chi sta per mollare.',
  },
  {
    icon: QrCode,
    title: 'Check-in QR Code',
    desc: 'Monitora la frequenza dei clienti con check-in tramite QR code, direttamente da WhatsApp.',
  },
  {
    icon: BarChart3,
    title: 'Analytics Avanzati',
    desc: 'KPI in tempo reale: retention, engagement, trend, scoring clienti. Dati, non sensazioni.',
  },
  {
    icon: Zap,
    title: 'Automazioni',
    desc: 'Reminder automatici, messaggi motivazionali, celebrazione traguardi. Il coach lavora anche quando dormi.',
    span: true,
  },
]

const steps = [
  { num: '1', title: 'Registra la tua palestra', desc: 'Crea il tuo account in 2 minuti. Nessuna carta di credito richiesta.', color: 'bg-blue-500' },
  { num: '2', title: 'Collega WhatsApp', desc: 'Scansiona il QR code e il tuo Coach AI è subito attivo sul tuo numero.', color: 'bg-[#25D366]' },
  { num: '3', title: 'Guarda i risultati', desc: 'I tuoi clienti iniziano a chattare. Tu monitori tutto dalla dashboard.', color: 'bg-primary-500' },
]

const plans = [
  {
    name: 'Trial',
    price: '0',
    period: '14 giorni gratis',
    features: ['Fino a 20 clienti', 'Coach AI su WhatsApp', 'Dashboard base', 'Supporto email'],
    cta: 'Inizia Gratis',
    highlighted: false,
  },
  {
    name: 'Starter',
    price: '49',
    period: '/mese',
    features: ['Fino a 50 clienti', 'Coach AI su WhatsApp', 'Promemoria automatici', 'Dashboard completa', 'Supporto email'],
    cta: 'Scegli Starter',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '79',
    period: '/mese',
    features: ['Fino a 150 clienti', 'Tutto di Starter', 'Brain AI Anti-Abbandono', 'Automazioni avanzate', 'Analytics premium', 'Supporto prioritario'],
    cta: 'Scegli Professional',
    highlighted: true,
    badge: 'Più Popolare',
  },
  {
    name: 'Premium',
    price: '129',
    period: '/mese',
    features: ['Clienti illimitati', 'Tutto di Professional', 'Referral program', 'API personalizzate', 'Account manager dedicato', 'Onboarding personalizzato'],
    cta: 'Scegli Premium',
    highlighted: false,
  },
]

const faqs = [
  {
    q: 'Come funziona Coach AI su WhatsApp?',
    a: 'Coach AI si collega al tuo numero WhatsApp Business tramite un QR code. I tuoi clienti scrivono normalmente su WhatsApp e l\'AI risponde in modo intelligente, gestendo conversazioni, schede di allenamento e motivazione.',
  },
  {
    q: 'I miei clienti devono scaricare un\'app?',
    a: 'No, assolutamente. I tuoi clienti usano WhatsApp che hanno già sul telefono. Zero download, zero registrazioni. Iniziano a chattare e basta.',
  },
  {
    q: 'Posso personalizzare le risposte del coach?',
    a: 'Sì. Puoi configurare il tono, lo stile e le informazioni della tua palestra. Il Brain AI impara dalle conversazioni e si adatta automaticamente ad ogni cliente.',
  },
  {
    q: 'Quanto tempo serve per configurare tutto?',
    a: 'Meno di 5 minuti. Crei l\'account, colleghi WhatsApp con un QR code, e il tuo Coach AI è operativo. L\'onboarding guidato ti accompagna passo per passo.',
  },
  {
    q: 'I dati dei miei clienti sono al sicuro?',
    a: 'Assolutamente. Ogni palestra ha un ambiente completamente isolato. I dati sono crittografati e conservati su server europei, in conformità con il GDPR.',
  },
  {
    q: 'Posso cancellare in qualsiasi momento?',
    a: 'Sì, nessun vincolo. Puoi disdire quando vuoi dalla dashboard. Se disdici, il tuo account resta attivo fino alla fine del periodo pagato.',
  },
]

// ==================== COMPONENT ====================

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  const navLinks = [
    { label: 'Funzionalità', id: 'funzionalita' },
    { label: 'Come Funziona', id: 'come-funziona' },
    { label: 'Prezzi', id: 'prezzi' },
    { label: 'FAQ', id: 'faq' },
  ]

  const handleNavClick = (id) => {
    scrollToSection(id)
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-landing-bg text-white font-sans antialiased">

      {/* ==================== NAVBAR ==================== */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-landing-bg/80 backdrop-blur-lg border-b border-landing-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">Coach AI</span>
            </div>

            {/* Desktop links */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map(link => (
                <button key={link.id} onClick={() => handleNavClick(link.id)}
                  className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                  {link.label}
                </button>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-4">
              <Link to="/login" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Accedi
              </Link>
              <Link to="/register"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-all">
                Prova Gratis
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button className="lg:hidden text-gray-300 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-landing-bg border-b border-landing-border px-4 pb-4 space-y-1">
            {navLinks.map(link => (
              <button key={link.id} onClick={() => handleNavClick(link.id)}
                className="block w-full text-left py-3 text-gray-300 hover:text-white text-sm font-medium">
                {link.label}
              </button>
            ))}
            <div className="pt-3 border-t border-landing-border flex flex-col gap-3">
              <Link to="/login" className="text-gray-300 hover:text-white text-sm font-medium py-2">Accedi</Link>
              <Link to="/register"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold text-sm text-center transition-all">
                Prova Gratis
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ==================== HERO ==================== */}
      <section className="pt-28 lg:pt-40 pb-16 lg:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text */}
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
              Il Personal Trainer{' '}
              <span className="text-blue-400">AI</span> che parla su{' '}
              <span className="text-[#25D366]">WhatsApp</span>{' '}
              con i tuoi clienti
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 mt-6 max-w-lg">
              Coach AI allena, motiva e trattiene i clienti della tua palestra — 24 ore su 24, direttamente su WhatsApp. Zero app da scaricare.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link to="/register"
                className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-blue-500/25">
                Prova Gratis 14 Giorni <ArrowRight className="w-5 h-5" />
              </Link>
              <button onClick={() => scrollToSection('funzionalita')}
                className="inline-flex items-center justify-center gap-2 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                Scopri di Più
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-6">Nessuna carta di credito richiesta</p>
          </div>

          {/* Right: WhatsApp mockup */}
          <div className="relative mx-auto w-72 sm:w-80">
            <div className="bg-landing-card rounded-3xl border border-landing-border p-3 shadow-2xl">
              {/* WhatsApp header */}
              <div className="bg-[#075E54] rounded-t-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Coach AI</p>
                  <p className="text-green-200 text-xs">online</p>
                </div>
              </div>
              {/* Chat */}
              <div className="bg-[#0B141A] p-4 space-y-3 rounded-b-2xl">
                <div className="bg-[#1F2C34] rounded-lg rounded-tl-none p-3 max-w-[85%]">
                  <p className="text-sm text-gray-200">Ciao Marco! Come va l'allenamento di oggi? Pronto per la scheda? 💪</p>
                  <p className="text-[10px] text-gray-500 text-right mt-1">09:30</p>
                </div>
                <div className="bg-[#005C4B] rounded-lg rounded-tr-none p-3 max-w-[85%] ml-auto">
                  <p className="text-sm text-gray-200">Sì tutto bene! Oggi vorrei fare petto e spalle</p>
                  <p className="text-[10px] text-gray-400 text-right mt-1">09:32</p>
                </div>
                <div className="bg-[#1F2C34] rounded-lg rounded-tl-none p-3 max-w-[85%]">
                  <p className="text-sm text-gray-200">Perfetto! Ecco la tua scheda personalizzata per oggi. Ho adattato il carico visto il tuo progresso 📋🔥</p>
                  <p className="text-[10px] text-gray-500 text-right mt-1">09:33</p>
                </div>
                <div className="bg-[#005C4B] rounded-lg rounded-tr-none p-3 max-w-[85%] ml-auto">
                  <p className="text-sm text-gray-200">Grande! Grazie coach 🙏</p>
                  <p className="text-[10px] text-gray-400 text-right mt-1">09:34</p>
                </div>
              </div>
            </div>
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-[#25D366]/20 rounded-3xl blur-xl -z-10"></div>
          </div>
        </div>
      </section>

      {/* ==================== PROBLEMA ==================== */}
      <section id="problema" className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center max-w-3xl mx-auto">
          Il <span className="text-red-400">67%</span> dei nuovi iscritti abbandona la palestra entro{' '}
          <span className="text-red-400">3 mesi</span>
        </h2>
        <p className="text-gray-400 text-center mt-4 max-w-xl mx-auto text-lg">
          E la maggior parte dei titolari se ne accorge quando è troppo tardi.
        </p>
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mt-16">
          {problems.map((p, i) => (
            <div key={i} className="bg-landing-card border border-landing-border rounded-2xl p-8 text-center hover:border-red-500/30 transition-all">
              <div className="w-14 h-14 bg-red-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <p.icon className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{p.title}</h3>
              <p className="text-gray-400">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== SOLUZIONE ==================== */}
      <section id="soluzione" className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center">
          La soluzione: <span className="text-blue-400">Coach AI</span>
        </h2>
        <p className="text-gray-400 text-center mt-4 max-w-xl mx-auto text-lg">
          Un sistema intelligente che parla con i tuoi clienti, prevede l'abbandono e agisce in automatico.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          {/* Pillar 1: WhatsApp */}
          <div className="bg-gradient-to-b from-landing-card to-landing-bg border border-landing-border rounded-2xl p-8 relative overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#25D366] to-green-400 absolute top-0 left-0 right-0"></div>
            <div className="w-14 h-14 bg-[#25D366]/10 rounded-xl flex items-center justify-center mb-6">
              <MessageSquare className="w-7 h-7 text-[#25D366]" />
            </div>
            <h3 className="text-xl font-bold mb-4">Coach AI su WhatsApp</h3>
            <ul className="space-y-3">
              {['Chat naturale in italiano', 'Schede di allenamento personalizzate', 'Motivazione e supporto continuo', 'Risposte 24/7'].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="w-5 h-5 text-[#25D366] shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pillar 2: Brain AI */}
          <div className="bg-gradient-to-b from-landing-card to-landing-bg border border-landing-border rounded-2xl p-8 relative overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500 absolute top-0 left-0 right-0"></div>
            <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
              <Brain className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">Brain AI Anti-Abbandono</h3>
            <ul className="space-y-3">
              {['Scoring rischio abbandono per cliente', 'Analisi automatica delle conversazioni', 'Messaggi personalizzati ai clienti a rischio', 'Intervento proattivo, non reattivo'].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pillar 3: Dashboard */}
          <div className="bg-gradient-to-b from-landing-card to-landing-bg border border-landing-border rounded-2xl p-8 relative overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary-500 to-emerald-400 absolute top-0 left-0 right-0"></div>
            <div className="w-14 h-14 bg-primary-500/10 rounded-xl flex items-center justify-center mb-6">
              <BarChart3 className="w-7 h-7 text-primary-400" />
            </div>
            <h3 className="text-xl font-bold mb-4">Dashboard Completa</h3>
            <ul className="space-y-3">
              {['Analytics in tempo reale', 'Lista clienti con scoring', 'Storico conversazioni', 'Gestione automazioni'].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-400">
                  <CheckCircle className="w-5 h-5 text-primary-400 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ==================== FUNZIONALITA ==================== */}
      <section id="funzionalita" className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center">
          Tutto quello che serve alla tua palestra
        </h2>
        <p className="text-gray-400 text-center mt-4 max-w-xl mx-auto text-lg">
          Un ecosistema completo per gestire, motivare e trattenere i tuoi clienti.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {features.map((f, i) => (
            <div key={i} className={`bg-landing-card border border-landing-border rounded-2xl p-8 hover:border-blue-500/30 transition-all group ${f.span ? 'lg:col-span-1' : ''}`}>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                <f.icon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== COME FUNZIONA ==================== */}
      <section id="come-funziona" className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center">
          Attivo in <span className="text-blue-400">3 semplici passi</span>
        </h2>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 mt-16 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-8 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-blue-500 via-[#25D366] to-primary-500"></div>

          {steps.map((s, i) => (
            <div key={i} className="text-center relative">
              <div className={`w-16 h-16 ${s.color} rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold relative z-10 shadow-lg`}>
                {s.num}
              </div>
              <h3 className="text-xl font-bold mb-3">{s.title}</h3>
              <p className="text-gray-400 max-w-xs mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== PREZZI ==================== */}
      <section id="prezzi" className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center">
          Scegli il piano giusto per la tua palestra
        </h2>
        <p className="text-gray-400 text-center mt-4 text-lg">
          Nessun vincolo. Disdici quando vuoi. Tutti i prezzi sono IVA esclusa.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 mt-16 items-start">
          {plans.map((plan, i) => (
            <div key={i}
              className={`rounded-2xl p-8 flex flex-col relative ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-blue-500/10 to-landing-card border-2 border-blue-500 lg:scale-105 shadow-xl shadow-blue-500/10'
                  : 'bg-landing-card border border-landing-border'
              }`}>
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-sm font-semibold px-4 py-1 rounded-full whitespace-nowrap">
                  {plan.badge}
                </div>
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold">{plan.price === '0' ? 'Gratis' : `€${plan.price}`}</span>
                {plan.price !== '0' && <span className="text-gray-400 text-lg">{plan.period}</span>}
                {plan.price === '0' && <p className="text-gray-400 text-sm mt-1">{plan.period}</p>}
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((f, fi) => (
                  <li key={fi} className="flex items-start gap-2 text-gray-300 text-sm">
                    <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlighted ? 'text-blue-400' : 'text-gray-500'}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register"
                className={`w-full py-3 rounded-xl font-semibold text-center transition-all block ${
                  plan.highlighted
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'border border-landing-border hover:border-gray-500 text-white'
                }`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section id="faq" className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-16">
          Domande Frequenti
        </h2>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-landing-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-6 text-left font-semibold hover:bg-landing-card/50 transition-colors">
                <span>{faq.q}</span>
                <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 ml-4 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-6 pb-6 text-gray-400">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ==================== CTA FINALE ==================== */}
      <section className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl border border-landing-border p-12 lg:p-20 text-center bg-gradient-to-r from-blue-600/10 via-landing-card to-primary-600/10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
            Dai ai tuoi clienti un coach che non si ferma mai
          </h2>
          <p className="text-gray-400 mt-6 text-lg max-w-2xl mx-auto">
            Inizia la prova gratuita di 14 giorni. Nessuna carta di credito richiesta. Attivo in 5 minuti.
          </p>
          <Link to="/register"
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-10 py-4 rounded-xl font-semibold text-lg mt-8 transition-all shadow-lg shadow-blue-500/25">
            Prova Coach AI Gratis <ArrowRight className="w-5 h-5" />
          </Link>
          {/* Background glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl"></div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="border-t border-landing-border py-12 lg:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Dumbbell className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold">Coach AI</span>
            </div>
            <p className="text-gray-500 text-sm">
              Il personal trainer AI per la tua palestra. Un prodotto italiano per le palestre italiane.
            </p>
          </div>

          {/* Prodotto */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Prodotto</h4>
            <ul className="space-y-2">
              {navLinks.map(link => (
                <li key={link.id}>
                  <button onClick={() => scrollToSection(link.id)}
                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Legale */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Legale</h4>
            <ul className="space-y-2">
              <li><span className="text-sm text-gray-500">Privacy Policy</span></li>
              <li><span className="text-sm text-gray-500">Termini di Servizio</span></li>
              <li><span className="text-sm text-gray-500">Cookie Policy</span></li>
            </ul>
          </div>

          {/* Contatti */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Contatti</h4>
            <ul className="space-y-2">
              <li><span className="text-sm text-gray-500">info@coachpalestra.it</span></li>
              <li><span className="text-sm text-gray-500">WhatsApp: +39 xxx xxx xxxx</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-landing-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">&copy; {new Date().getFullYear()} Coach AI — coachpalestra.it. Tutti i diritti riservati.</p>
        </div>
      </footer>
    </div>
  )
}
