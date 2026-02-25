// src/components/Bot/BotStatus.jsx
import { useState, useEffect } from 'react'
import { Play, Square } from 'lucide-react'
import { motion } from 'framer-motion'

export default function BotStatus() {
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setRunning(prev => !prev), 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        padding: '20px',
        background: running ? '#d4edda' : '#f8d7da',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        fontWeight: 'bold',
        boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
        border: running ? '2px solid #28a745' : '2px solid #dc3545'
      }}
    >
      <motion.div
        animate={{ scale: running ? [1, 1.2, 1] : 1 }}
        transition={{ repeat: running ? Infinity : 0, duration: 1.5 }}
      >
        {running ? <Play color="#155724" size={28} /> : <Square color="#721c24" size={28} />}
      </motion.div>
      <motion.span
        animate={{ color: running ? '#155724' : '#721c24' }}
        transition={{ duration: 0.3 }}
      >
        Bot : {running ? 'EN COURS' : 'ARRÊTÉ'}
      </motion.span>
    </motion.div>
  )
}