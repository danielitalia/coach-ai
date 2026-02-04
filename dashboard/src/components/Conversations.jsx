import React, { useState, useEffect, useRef } from 'react'
import { Search, Phone, ArrowLeft, User, RefreshCw } from 'lucide-react'

const API_URL = ''

function Conversations() {
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    fetchConversations()
    const interval = setInterval(fetchConversations, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.phone)
      const interval = setInterval(() => fetchMessages(selectedConversation.phone), 3000)
      return () => clearInterval(interval)
    }
  }, [selectedConversation])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/conversations`)
      if (res.ok) {
        const data = await res.json()
        setConversations(data)
      }
    } catch (err) {
      console.log('Errore fetch conversazioni:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (phone) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations/${phone}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (err) {
      console.log('Errore fetch messaggi:', err)
    }
  }

  const filteredConversations = conversations.filter(conv =>
    (conv.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (conv.phone || '').includes(searchTerm)
  )

  return (
    <div className="h-[calc(100vh-180px)] flex bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Conversation List */}
      <div className={`w-full md:w-80 border-r border-gray-200 flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Conversazioni</h2>
            <button
              onClick={fetchConversations}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Aggiorna"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Caricamento...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Nessuna conversazione</p>
              <p className="text-sm mt-2">Invia un messaggio WhatsApp al numero della palestra per iniziare</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.phone}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  selectedConversation?.phone === conv.phone ? 'bg-primary-50' : ''
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-medium">
                      {(conv.name || conv.phone || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {conv.unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center">
                      {conv.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 truncate">{conv.name || `+${conv.phone}`}</p>
                    <span className="text-xs text-gray-400">{formatTime(conv.timestamp)}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{conv.lastMessage || 'Nuova conversazione'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat View */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 flex items-center gap-4">
            <button
              onClick={() => setSelectedConversation(null)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 font-medium">
                {(selectedConversation.name || selectedConversation.phone || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">
                {selectedConversation.name || `Cliente ${selectedConversation.phone?.slice(-4)}`}
              </h3>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                +{selectedConversation.phone}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Nessun messaggio
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.role === 'assistant'
                        ? 'bg-white border border-gray-200 text-gray-900'
                        : 'bg-primary-500 text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    <p className={`text-xs mt-1 ${
                      msg.role === 'assistant' ? 'text-gray-400' : 'text-primary-200'
                    }`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input (disabled - bot only) */}
          <div className="p-4 border-t border-gray-200 bg-gray-100">
            <p className="text-sm text-gray-500 text-center">
              Le risposte sono gestite automaticamente da Coach AI
            </p>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">Seleziona una conversazione</p>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(date) {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diff = now - d

  if (diff < 86400000) {
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
}

export default Conversations
