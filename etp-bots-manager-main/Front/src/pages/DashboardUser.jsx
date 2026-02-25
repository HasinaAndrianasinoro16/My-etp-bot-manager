// src/pages/DashboardUser.jsx 

import { motion } from 'framer-motion'
import { Bot, LogOut, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

import BotManager from '../components/Bot/BotManager'


export default function DashboardUser() {
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulation de chargement rapide
    const timer = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f1f5f9',
        fontFamily: 'Inter, sans-serif',
        color: '#64748b'
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        >
          <Bot size={80} />
        </motion.div>
        <p style={{ marginTop: '32px', fontSize: '24px', fontWeight: '600' }}>
          Chargement de votre espace...
        </p>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      padding: '40px 20px',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>

        {/* HEADER PREMIUM */}
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style={{
            background: 'white',
            padding: '48px',
            borderRadius: '36px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.12)',
            marginBottom: '60px',
            border: '1px solid #e2e8f0',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '12px',
            background: 'linear-gradient(90deg, #667eea, #764ba2)'
          }} />

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '32px'
          }}>
            <div>
              <h1 style={{
                fontSize: '48px',
                fontWeight: '900',
                color: '#1e293b',
                margin: '0 0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '24px'
              }}>
                <Bot size={56} style={{ color: '#667eea' }} />
                Mes Bots
              </h1>
              <p style={{
                margin: 0,
                fontSize: '22px',
                color: '#64748b',
                fontWeight: '600'
              }}>
                Bienvenue, <strong>{user?.email || 'Utilisateur'}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: '24px' }}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/user/profile"
                  style={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    padding: '20px 40px',
                    borderRadius: '28px',
                    fontSize: '19px',
                    fontWeight: '800',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    boxShadow: '0 16px 50px rgba(102,126,234,0.4)',
                  }}
                >
                  <Mail size={28} />
                  Mon Profil
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* BOT MANAGER – Pleine largeur */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ marginBottom: '60px' }}
        >
          <BotManager />
        </motion.div>

        {/* LOGS + MAILS – Côte à côte */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '48px',
          }}
        >
          <LogsViewer />
          <MailsTable />
        </motion.div>

        {/* DÉCONNEXION */}
        <div style={{ textAlign: 'center', marginTop: '80px' }}>
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            onClick={logout}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              border: 'none',
              padding: '20px 48px',
              borderRadius: '32px',
              fontSize: '20px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              margin: '0 auto',
              boxShadow: '0 20px 60px rgba(239,68,68,0.4)',
            }}
          >
            <LogOut size={32} />
            Déconnexion
          </motion.button>
        </div>
      </div>
    </div>
  )
}