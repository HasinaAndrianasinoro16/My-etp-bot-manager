// src/components/Monitoring/LogsViewer.jsx

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Bot, Zap, AlertCircle, Send, Mail, ChevronDown, ChevronUp, Eye, Filter, Download } from 'lucide-react'

const ICONS = {
  success: CheckCircle,
  info: Bot,
  analysis: Zap,
  warning: AlertCircle,
  sync: Send,
  email: Mail
}

const COLORS = {
  success: 'rgba(95, 204, 128, 0.12)',
  info: 'rgba(0, 48, 135, 0.12)',
  analysis: 'rgba(139, 92, 246, 0.12)',
  warning: 'rgba(227, 146, 12, 0.12)',
  sync: 'rgba(23, 70, 217, 0.12)',
  email: 'rgba(0, 48, 135, 0.12)'
}

const TEXT_COLORS = {
  success: '#5FCC80',
  info: '#003087',
  analysis: '#8b5cf6',
  warning: '#E3920C',
  sync: '#1746D9',
  email: '#003087'
}

export default function LogsViewer() {
  const [logs, setLogs] = useState([])
  const [visibleCount, setVisibleCount] = useState(5)
  const [showAll, setShowAll] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [autoScroll, setAutoScroll] = useState(false) 
  const logsContainerRef = useRef(null)
  const endRef = useRef(null)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isUserAtBottom = () => {
    if (!logsContainerRef.current) return false
    
    const container = logsContainerRef.current
    const tolerance = 50
    
    return Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) <= tolerance
  }

  const handleAutoScroll = () => {
    if (autoScroll && endRef.current && isUserAtBottom()) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    handleAutoScroll()
  }, [logs, autoScroll])

  useEffect(() => {
    const container = logsContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (!isUserAtBottom()) {
        setAutoScroll(false)
      } else {
        setAutoScroll(true)
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleAutoScroll = () => {
    const newAutoScrollState = !autoScroll
    setAutoScroll(newAutoScrollState)
    
    if (newAutoScrollState && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const systemMessages = [
      { type: 'success', msg: 'Connexion IMAP vérifiée avec succès' },
      { type: 'info', msg: 'Analyse des nouveaux messages en cours...' },
      { type: 'analysis', msg: 'Filtrage avancé appliqué sur les emails entrants' },
      { type: 'warning', msg: 'Aucun email correspondant aux règles de filtrage' },
      { type: 'sync', msg: 'Synchronisation complète avec le serveur IMAP' },
      { type: 'email', msg: 'Nouvel email reçu et traité automatiquement' },
      { type: 'info', msg: 'Bot en mode veille – surveillance active' },
      { type: 'success', msg: 'Tous les processus sont opérationnels' },
      { type: 'analysis', msg: 'Vérification des performances système' },
      { type: 'email', msg: 'Email de test envoyé avec succès' }
    ]

    const addRandomLog = () => {
      const random = systemMessages[Math.floor(Math.random() * systemMessages.length)]
      const time = new Date().toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })
      const date = new Date().toLocaleDateString('fr-FR')

      setLogs(prev => [...prev.slice(-50), {
        id: Date.now() + Math.random(),
        date,
        time,
        type: random.type,
        msg: random.msg,
        timestamp: Date.now()
      }])
    }

    const initialLogs = [
      {
        id: 'init1',
        date: new Date().toLocaleDateString('fr-FR'),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'success',
        msg: 'Système MINIBOT démarré – Connexion IMAP établie',
        timestamp: Date.now()
      },
      {
        id: 'init2',
        date: new Date().toLocaleDateString('fr-FR'),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'info',
        msg: 'Initialisation des modules de surveillance',
        timestamp: Date.now() - 1000
      },
      {
        id: 'init3',
        date: new Date().toLocaleDateString('fr-FR'),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'analysis',
        msg: 'Configuration des règles de filtrage activée',
        timestamp: Date.now() - 2000
      }
    ]

    setLogs(initialLogs)

    const interval = setInterval(addRandomLog, 5000 + Math.random() * 7000)
    return () => clearInterval(interval)
  }, [])

  const filteredLogs = filterType === 'all' 
    ? logs 
    : logs.filter(log => log.type === filterType)

  const displayedLogs = showAll ? filteredLogs : filteredLogs.slice(-visibleCount)

  const handleShowMore = () => {
    setShowAll(true)
    setVisibleCount(filteredLogs.length)
  }

  const handleShowLess = () => {
    setShowAll(false)
    setVisibleCount(5)
  }

  const exportLogs = () => {
    const logText = logs.map(log => 
      `[${log.date} ${log.time}] ${log.type.toUpperCase()}: ${log.msg}`
    ).join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-minibot-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: 'white',
        padding: windowWidth < 768 ? '20px' : '40px',
        borderRadius: '28px',
        minHeight: '600px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, sans-serif',
        border: '1px solid rgba(229, 235, 249, 0.8)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: windowWidth < 768 ? '200px' : '300px',
        height: windowWidth < 768 ? '200px' : '300px',
        background: 'radial-gradient(circle at top right, rgba(0, 48, 135, 0.06) 0%, transparent 70%)',
        zIndex: 0,
      }} />
      
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: windowWidth < 768 ? '150px' : '200px',
        height: windowWidth < 768 ? '150px' : '200px',
        background: 'radial-gradient(circle at bottom left, rgba(95, 204, 128, 0.04) 0%, transparent 70%)',
        zIndex: 0,
      }} />

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '32px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div>
          <h3 style={{ 
            margin: '0 0 8px 0', 
            fontSize: windowWidth < 768 ? '24px' : '32px',
            fontWeight: '900', 
            color: '#010C28',
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            letterSpacing: '-0.5px',
          }}>
            <div style={{
              background: '#003087',
              borderRadius: '14px',
              padding: windowWidth < 768 ? '8px' : '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0, 48, 135, 0.3)',
            }}>
              <Zap size={windowWidth < 768 ? 24 : 30} style={{ color: 'white' }} />
            </div>
            Journaux en direct
          </h3>
          <p style={{ 
            margin: 0, 
            color: '#242D45', 
            opacity: 0.7,
            fontSize: windowWidth < 768 ? '14px' : '16px',
            fontWeight: '500',
          }}>
            Surveillance temps réel de l'activité système
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              background: 'rgba(95, 204, 128, 0.15)',
              color: '#5FCC80',
              padding: '10px 24px',
              borderRadius: '50px',
              fontWeight: '800',
              fontSize: windowWidth < 768 ? '13px' : '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: '1px solid rgba(95, 204, 128, 0.2)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ 
              width: '10px', 
              height: '10px', 
              background: '#5FCC80', 
              borderRadius: '50%',
              animation: 'pulse 2s infinite',
            }} />
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}</style>
            EN LIGNE
          </motion.div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleAutoScroll}
            style={{
              background: autoScroll 
                ? 'rgba(95, 204, 128, 0.15)' 
                : 'rgba(227, 146, 12, 0.15)',
              border: autoScroll 
                ? '1px solid rgba(95, 204, 128, 0.3)' 
                : '1px solid rgba(227, 146, 12, 0.3)',
              color: autoScroll ? '#5FCC80' : '#E3920C',
              padding: '10px 20px',
              borderRadius: '12px',
              fontWeight: '600',
              fontSize: windowWidth < 768 ? '13px' : '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
            }}
          >
            <ChevronDown size={windowWidth < 768 ? 16 : 18} />
            {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={exportLogs}
            style={{
              background: 'rgba(0, 48, 135, 0.1)',
              border: '1px solid rgba(0, 48, 135, 0.2)',
              color: '#003087',
              padding: '10px 20px',
              borderRadius: '12px',
              fontWeight: '600',
              fontSize: windowWidth < 768 ? '13px' : '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Download size={windowWidth < 768 ? 16 : 18} />
            Exporter
          </motion.button>
        </div>
      </div>

      <div style={{ 
        marginBottom: '24px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            color: '#242D45',
            opacity: 0.7,
            fontSize: windowWidth < 768 ? '13px' : '14px',
            fontWeight: '600',
          }}>
            <Filter size={windowWidth < 768 ? 16 : 18} />
            Filtre :
          </div>
          
          {['all', 'success', 'info', 'analysis', 'warning', 'sync', 'email'].map(type => {
            const Icon = type !== 'all' ? ICONS[type] : null;
            return (
              <motion.button
                key={type}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilterType(type)}
                style={{
                  background: filterType === type 
                    ? (TEXT_COLORS[type] || '#003087')
                    : 'rgba(229, 235, 249, 0.6)',
                  color: filterType === type ? 'white' : '#242D45',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: windowWidth < 768 ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                {Icon && <Icon size={windowWidth < 768 ? 12 : 14} />}
                {type === 'all' ? 'Tous' : type.charAt(0).toUpperCase() + type.slice(1)}
              </motion.button>
            );
          })}

          <div style={{ 
            marginLeft: 'auto', 
            color: '#242D45', 
            opacity: 0.7,
            fontSize: windowWidth < 768 ? '13px' : '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <Eye size={windowWidth < 768 ? 14 : 16} />
            {filteredLogs.length} événements
          </div>
        </div>
      </div>

      <div 
        ref={logsContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '8px',
          marginRight: '-8px',
          position: 'relative',
          zIndex: 1,
          background: 'rgba(248, 250, 252, 0.5)',
          borderRadius: '20px',
          padding: '20px',
          border: '1px solid rgba(229, 235, 249, 0.6)',
        }}
      >
        <AnimatePresence>
          {displayedLogs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: '#242D45',
                opacity: 0.5,
                textAlign: 'center',
              }}
            >
              <AlertCircle size={windowWidth < 768 ? 40 : 48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p style={{ fontSize: windowWidth < 768 ? '16px' : '18px', fontWeight: '600', margin: 0 }}>
                Aucun log correspondant au filtre
              </p>
              <p style={{ fontSize: windowWidth < 768 ? '13px' : '14px', marginTop: '8px' }}>
                Modifiez les filtres ou attendez de nouveaux événements
              </p>
            </motion.div>
          ) : (
            displayedLogs.map((log, index) => {
              const Icon = ICONS[log.type]
              const isNew = index === displayedLogs.length - 1 && Date.now() - log.timestamp < 10000
              
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  style={{
                    padding: '20px',
                    marginBottom: '12px',
                    borderRadius: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    background: COLORS[log.type],
                    border: `1px solid ${TEXT_COLORS[log.type]}20`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {isNew && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2 }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '3px',
                        background: `linear-gradient(90deg, ${TEXT_COLORS[log.type]}, transparent)`,
                      }}
                    />
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flex: 1,
                  }}>
                    <div style={{
                      background: 'white',
                      borderRadius: '12px',
                      padding: windowWidth < 768 ? '8px' : '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    }}>
                      <Icon size={windowWidth < 768 ? 20 : 24} style={{ color: TEXT_COLORS[log.type] }} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}>
                        <span style={{ 
                          color: TEXT_COLORS[log.type], 
                          fontWeight: '700', 
                          fontSize: windowWidth < 768 ? '13px' : '15px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          {log.type}
                        </span>
                        <span style={{ 
                          color: '#242D45', 
                          opacity: 0.7,
                          fontWeight: '600', 
                          fontSize: windowWidth < 768 ? '12px' : '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}>
                          <span>{log.date}</span>
                          <span style={{ 
                            background: '#E5EBF9',
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                          }} />
                          <span style={{ color: '#010C28', fontWeight: '700' }}>
                            {log.time}
                          </span>
                        </span>
                      </div>
                      <p style={{ 
                        margin: 0, 
                        color: '#010C28', 
                        fontSize: windowWidth < 768 ? '14px' : '16px',
                        fontWeight: '500',
                        lineHeight: 1.5,
                      }}>
                        {log.msg}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {filteredLogs.length > 5 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '24px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {!showAll ? (
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(0, 48, 135, 0.2)' }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShowMore}
              style={{
                background: '#003087',
                color: 'white',
                border: 'none',
                padding: '14px 32px',
                borderRadius: '14px',
                fontWeight: '700',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0, 48, 135, 0.3)',
              }}
            >
              <ChevronDown size={20} />
              Voir plus ({filteredLogs.length - 5} autres)
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(229, 235, 249, 0.4)' }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShowLess}
              style={{
                background: 'white',
                color: '#010C28',
                border: '1px solid #E5EBF9',
                padding: '14px 32px',
                borderRadius: '14px',
                fontWeight: '700',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
              }}
            >
              <ChevronUp size={20} />
              Réduire (voir les 5 derniers)
            </motion.button>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}