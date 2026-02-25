// src/components/Bot/RulesCRUD.jsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Check, Zap, AlertCircle } from 'lucide-react'
import { api } from '../../services/api'

export default function RulesCRUD() {
  const [rules, setRules] = useState([])
  const [newLibelle, setNewLibelle] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const load = async () => {
      setFetching(true)
      setError('')
      try {
        const data = await api.getRules()
        setRules(Array.isArray(data) ? data : [])
      } catch (err) {
        setError('Règles indisponibles (mock)')
        setRules([])
      } finally {
        setFetching(false)
      }
    }
    load()
  }, [])

  const addRule = async () => {
    if (!newLibelle.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const created = await api.createRule({ libelle: newLibelle })
      setRules(prev => [...prev, created])
      setNewLibelle('')
      setSuccess('Règle ajoutée')
    } catch (err) {
      setError('Échec création (mock)')
      // Ajout local même si API échoue
      setRules(prev => [...prev, { id: Date.now(), libelle: newLibelle }])
      setNewLibelle('')
    } finally {
      setLoading(false)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const deleteRule = async (id) => {
    setLoading(true)
    try {
      await api.deleteRule(id).catch(() => {}) // 404 ignoré
      setRules(prev => prev.filter(r => r.id !== id))
      setSuccess('Règle supprimée')
    } catch (err) {
      // Suppression locale même si 404
      setRules(prev => prev.filter(r => r.id !== id))
    } finally {
      setLoading(false)
      setTimeout(() => setSuccess(''), 2000)
    }
  }

  // === STYLE RESPONSIVE + ANIMATIONS SIMPLES ===
  const container = {
    background: 'rgba(255, 255, 255, 0.94)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255, 255, 255, 0.5)',
    padding: 'clamp(25px, 5vw, 34px)',
    borderRadius: 'clamp(24px, 4vw, 34px)',
    boxShadow: '0 32px 80px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.7)',
    maxWidth: 'min(90vw, 760px)',
    width: '100%',
    margin: '20px auto',
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box'
  }

  const title = {
    margin: '0 0 32px',
    fontSize: 'clamp(24px, 5vw, 28px)',
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px'
  }

  const ruleCard = {
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white',
    padding: '22px',
    borderRadius: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 12px 32px rgba(99,102,241,0.35)',
    transition: 'all 0.3s ease'
  }

  const deleteBtn = {
    background: 'rgba(255,255,255,0.3)',
    backdropFilter: 'blur(10px)',
    border: 'none',
    borderRadius: '50%',
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.25s ease',
    opacity: loading ? 0.6 : 1
  }

  const inputWrapper = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '28px',
    background: 'rgba(250,251,253,0.9)',
    backdropFilter: 'blur(16px)',
    borderRadius: '24px',
    border: '2px dashed rgba(99,102,241,0.35)',
    transition: 'all 0.3s ease',
    boxShadow: '0 10px 30px rgba(0,0,0,0.06)'
  }

  const input = {
    padding: '16px 18px',
    border: '2px solid rgba(148,163,184,0.25)',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.98)',
    fontSize: '15.5px',
    outline: 'none',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
    width: '100%',
    boxSizing: 'border-box'
  }

  const validateBtn = {
    background: loading
      ? 'linear-gradient(135deg, #94a3b8, #64748b)'
      : 'linear-gradient(135deg, #10b981, #059669)',
    color: 'white',
    border: 'none',
    padding: '16px 32px',
    borderRadius: '50px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    boxShadow: '0 10px 28px rgba(16,185,129,0.4)',
    transition: 'all 0.3s ease',
    margin: '0 auto',
    minWidth: '160px'
  }

  return (
    <motion.div
      style={container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h3 style={title}>
          <Zap size={28} style={{ color: '#10b981' }} />
          Règles de parsing
        </h3>

        {fetching && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            Chargement...
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                background: 'rgba(239,68,68,0.15)',
                color: '#dc2626',
                padding: '14px 18px',
                borderRadius: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: '600',
                border: '1px solid rgba(239,68,68,0.3)'
              }}
            >
              <AlertCircle size={20} />
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                background: 'rgba(34,197,94,0.15)',
                color: '#16a34a',
                padding: '14px 18px',
                borderRadius: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: '600',
                border: '1px solid rgba(34,197,94,0.3)'
              }}
            >
              <Check size={20} />
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'grid', gap: '20px', marginBottom: '32px' }}>
          <AnimatePresence>
            {rules.map((rule) => (
              <motion.div
                key={rule.id} // CLÉ UNIQUE
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -3 }}
                style={ruleCard}
              >
                <div style={{ fontWeight: 700, fontSize: '17px', wordBreak: 'break-word' }}>
                  {rule.libelle}
                </div>
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => !loading && deleteRule(rule.id)}
                  style={deleteBtn}
                  disabled={loading}
                >
                  <Trash2 size={19} />
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {!fetching && rules.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '36px',
            color: '#64748b',
            background: 'rgba(248,250,252,0.8)',
            borderRadius: '20px',
            border: '2px dashed #cbd5e1'
          }}>
            Aucune règle définie
          </div>
        )}

        <div style={inputWrapper}>
          <motion.input
            placeholder="Libellé de la règle"
            value={newLibelle}
            onChange={e => setNewLibelle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRule()}
            style={input}
            disabled={loading}
            whileFocus={{ scale: 1.02, borderColor: '#6366f1' }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            onClick={addRule}
            style={validateBtn}
            disabled={loading || !newLibelle.trim()}
          >
            {loading ? 'Ajout...' : (
              <>
                <Plus size={20} />
                Ajouter
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}