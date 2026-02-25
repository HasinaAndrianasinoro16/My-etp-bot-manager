// src/components/Bot/ConfigIMAP.jsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Server, Globe, Shield, Zap, Save, Check, AlertCircle, Play, Square } from 'lucide-react'
import { api } from '../../services/api'

export default function ConfigIMAP() {
  const [bot, setBot] = useState(null)
  const [config, setConfig] = useState({
    title: 'Bot IMAP',
    email: '',
    password: '',
    imapServer: '',
    port: '993'
  })
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadBot = async () => {
      try {
        const bots = await api.getBots()
        if (bots && bots.length > 0) {
          const existing = bots[0]
          setBot(existing)
          setConfig({
            title: existing.title || 'Bot IMAP',
            email: existing.email || '',
            password: existing.password || '',
            imapServer: existing.imapServer || '',
            port: existing.port || '993'
          })
        }
      } catch (err) {
        console.error('Erreur chargement bot', err)
      }
    }
    loadBot()
  }, [])

  const handleSave = async () => {
    setLoading(true)
    setError('')
    setSaved(false)

    try {
      const payload = {
        id: bot?.id,
        title: config.title,
        email: config.email,
        password: config.password,
        imapServer: config.imapServer,
        port: config.port,
        status: bot?.status || 0,
        regle: bot?.regle || null
      }

      let updated
      if (bot?.id) {
        updated = await api.updateBot(payload)
      } else {
        updated = await api.createBot(payload)
      }

      setBot(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Échec sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  const toggleBot = async () => {
    if (!bot?.id) return
    setLoading(true)
    try {
      if (bot.status === 1) {
        try { await api.stopBot(bot.id) } catch {}
        setBot({ ...bot, status: 0 })
      } else {
        try { await api.startBot(bot.id) } catch {}
        setBot({ ...bot, status: 1 })
      }
    } catch (err) {
      // 404 ignoré
    } finally {
      setLoading(false)
    }
  }

  // === STYLES RESPONSIVES & ANIMÉS ===
  const containerStyle = {
    background: 'linear-gradient(145deg, #1e3c72 0%, #2a5298 100%)',
    color: 'white',
    padding: 'clamp(25px, 5vw, 40px)',
    borderRadius: 'clamp(18px, 3vw, 28px)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
    maxWidth: 'min(90vw, 650px)',
    width: '100%',
    margin: '20px auto',
    position: 'relative',
    overflow: 'hidden',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.12)',
    boxSizing: 'border-box'
  }

  const bgStyle = {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 20% 80%, rgba(120,119,198,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(120,119,198,0.2) 0%, transparent 50%)',
    backgroundSize: '200% 200%',
    pointerEvents: 'none',
    opacity: 0.15
  }

  const contentStyle = { position: 'relative', zIndex: 2 }

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '30px',
    flexWrap: 'wrap'
  }

  const iconWrapperStyle = {
    background: 'rgba(255,255,255,0.12)',
    padding: 'clamp(12px, 2.5vw, 16px)',
    borderRadius: '50%',
    backdropFilter: 'blur(10px)',
    flexShrink: 0
  }

  const titleStyle = {
    margin: 0,
    fontSize: 'clamp(24px, 5vw, 28px)',
    fontWeight: 'bold',
    lineHeight: 1.2
  }

  const subtitleStyle = {
    margin: '4px 0 0',
    opacity: 0.92,
    fontSize: 'clamp(14px, 3.5vw, 16px)'
  }

  const formStyle = {
    display: 'grid',
    gap: 'clamp(18px, 4vw, 24px)'
  }

  const fieldStyle = (delay) => ({
    opacity: 0,
    transform: 'translateY(20px)',
    animation: `fadeUp 0.5s ease-out ${delay}s forwards`
  })

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontWeight: 'bold',
    marginBottom: '8px',
    fontSize: 'clamp(14px, 3.5vw, 15px)'
  }

  const inputStyle = {
    width: '100%',
    padding: 'clamp(12px, 3vw, 16px)',
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    borderRadius: '14px',
    color: 'white',
    fontSize: 'clamp(15px, 4vw, 17px)',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
    outline: 'none',
    boxSizing: 'border-box'
  }

  const inputFocus = {
    background: 'rgba(255,255,255,0.25)',
    boxShadow: '0 0 0 3px rgba(102,126,234,0.3)'
  }

  const portGroupStyle = {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  }

  const portInputStyle = {
    flex: 1,
    minWidth: '100px',
    padding: 'clamp(14px, 3vw, 16px)',
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    borderRadius: '14px',
    color: 'white',
    fontSize: 'clamp(15px, 4vw, 17px)',
    boxSizing: 'border-box'
  }

  const sslBadgeStyle = {
    background: 'rgba(255,255,255,0.2)',
    padding: 'clamp(12px, 2.5vw, 16px) clamp(16px, 3vw, 20px)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600,
    fontSize: 'clamp(14px, 3.5vw, 15px)',
    whiteSpace: 'nowrap'
  }

  const actionsStyle = {
    marginTop: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'center'
  }

  const buttonStyle = (isSaved) => ({
    background: isSaved 
      ? 'linear-gradient(45deg, #28a745, #20c997)' 
      : 'linear-gradient(45deg, #11998e, #38ef7d)',
    color: 'white',
    border: 'none',
    padding: 'clamp(16px, 4vw, 18px) clamp(40px, 8vw, 50px)',
    borderRadius: '50px',
    fontSize: 'clamp(16px, 4.5vw, 18px)',
    fontWeight: 'bold',
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '15px',
    boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
    transition: 'all 0.3s ease',
    opacity: loading ? 0.7 : 1,
    width: '100%',
    maxWidth: '380px',
    justifyContent: 'center'
  })

  const startStopBtn = {
    background: bot?.status === 1 
      ? 'linear-gradient(45deg, #dc2626, #ef4444)' 
      : 'linear-gradient(45deg, #10b981, #059669)',
    color: 'white',
    border: 'none',
    padding: 'clamp(14px, 3.5vw, 16px) clamp(32px, 7vw, 40px)',
    borderRadius: '50px',
    fontSize: 'clamp(15px, 4vw, 17px)',
    fontWeight: 'bold',
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
    width: '100%',
    maxWidth: '380px',
    justifyContent: 'center'
  }

  const successStyle = {
    marginTop: '16px',
    background: 'rgba(40,167,69,0.2)',
    border: '1px solid rgba(40,167,69,0.5)',
    borderRadius: '12px',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '15px',
    width: '100%',
    maxWidth: '380px'
  }

  const keyframes = `
    @keyframes fadeUp {
      to { opacity: 1; transform: translateY(0); }
    }
  `

  const fields = [
    { icon: Mail, label: 'Email du robot', placeholder: 'robot@minibot.com', type: 'email', key: 'email', delay: 0.1 },
    { icon: Lock, label: 'Mot de passe', placeholder: '••••••••', type: 'password', key: 'password', delay: 0.2 },
    { icon: Server, label: 'Serveur IMAP', placeholder: 'imap.gmail.com', type: 'text', key: 'imapServer', delay: 0.3 },
  ]

  return (
    <>
      <style>{keyframes}</style>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 120 }}
        style={containerStyle}
      >
        <motion.div
          animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          style={bgStyle}
        />

        <div style={contentStyle}>
          <motion.div 
            style={headerStyle}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              style={iconWrapperStyle}
            >
              <Globe size={32} />
            </motion.div>
            <div>
              <h3 style={titleStyle}>Connexion IMAP</h3>
              <p style={subtitleStyle}>Configurez la boîte mail du robot</p>
            </div>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ ...successStyle, background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.5)', color: '#fca5a5' }}
              >
                <AlertCircle size={22} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div style={formStyle}>
            {fields.map((field) => (
              <motion.div
                key={field.key}
                style={fieldStyle(field.delay)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: field.delay + 0.2 }}
              >
                <label style={labelStyle}>
                  <field.icon size={20} />
                  {field.label}
                </label>
                <motion.input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={config[field.key]}
                  onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                  style={inputStyle}
                  onFocus={(e) => Object.assign(e.target.style, inputFocus)}
                  onBlur={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.15)'
                    e.target.style.boxShadow = 'none'
                  }}
                  disabled={loading}
                  whileFocus={{ scale: 1.02 }}
                />
              </motion.div>
            ))}

            <motion.div
              style={fieldStyle(0.4)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <label style={labelStyle}>
                <Zap size={20} />
                Port (défaut: 993)
              </label>
              <div style={portGroupStyle}>
                <input
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: e.target.value })}
                  style={portInputStyle}
                  disabled={loading}
                />
                <div style={sslBadgeStyle}>
                  <Shield size={18} />
                  SSL
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div 
            style={actionsStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <motion.button
              whileHover={{ scale: loading ? 1 : 1.05 }}
              whileTap={{ scale: loading ? 1 : 0.95 }}
              onClick={handleSave}
              style={buttonStyle(saved)}
              disabled={loading}
            >
              <Save size={26} />
              {loading ? 'Sauvegarde...' : saved ? 'Connecté !' : 'Activer la connexion'}
            </motion.button>

            {bot && (
              <motion.button
                whileHover={{ scale: loading ? 1 : 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleBot}
                style={startStopBtn}
                disabled={loading}
              >
                {bot.status === 1 ? <Square size={24} /> : <Play size={24} />}
                {bot.status === 1 ? 'Arrêter le bot' : 'Démarrer le bot'}
              </motion.button>
            )}

            <AnimatePresence>
              {saved && !error && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  style={successStyle}
                >
                  <Check size={22} color="#28a745" />
                  <span>Configuration sauvegardée !</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>
    </>
  )
}