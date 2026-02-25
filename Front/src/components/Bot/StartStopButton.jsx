// src/components/Bot/StartStopButton.jsx
import { useState } from 'react'
import { Play, Square } from 'lucide-react'
import { motion } from 'framer-motion'

export default function StartStopButton() {
  const [running, setRunning] = useState(false)

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      animate={{ 
        boxShadow: running 
          ? ['0 0 0 rgba(220,53,69,0)', '0 0 30px rgba(220,53,69,0.7)', '0 0 0 rgba(220,53,69,0)']
          : ['0 0 0 rgba(40,167,69,0)', '0 0 30px rgba(40,167,69,0.7)', '0 0 0 rgba(40,167,69,0)']
      }}
      transition={{ repeat: Infinity, duration: 2 }}
      onClick={() => setRunning(!running)}
      style={{
        padding: '16px 32px',
        background: running ? '#dc3545' : '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontWeight: 'bold',
        fontSize: '18px',
        cursor: 'pointer',
        boxShadow: '0 8px 25px rgba(0,0,0,0.2)'
      }}
    >
      {running ? <Square size={24} /> : <Play size={24} />}
      {running ? 'Arrêter le bot' : 'Démarrer le bot'}
    </motion.button>
  )
}