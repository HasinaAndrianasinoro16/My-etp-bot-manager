// src/components/Bot/BotManager.jsx
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  Calendar,
  Circle,
  Edit3,
  File,
  FileText,
  FolderOpen,
  Hash,
  Mail,
  Play,
  Plus,
  Square,
  Trash2,
  X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../services/api'

const STATUS_CONFIG = {
  0: { 
    color: '#D81717', 
    bg: 'rgba(216, 23, 23, 0.08)', 
    label: 'Arrêté',
    icon: Circle
  },
  1: { 
    color: '#5FCC80', 
    bg: 'rgba(95, 204, 128, 0.08)', 
    label: 'En cours',
    icon: Activity
  }
}

const FIELD_ICONS = {
  1: FileText,
  2: Calendar,
  3: Mail,
  4: Hash,
  5: Hash,
  6: File,
  7: FolderOpen,
  8: File
}

const FIELD_LABELS = {
  1: 'Avec pièce jointe',
  2: 'Date d\'envoi',
  3: 'Expéditeur',
  4: 'Sujet',
  5: 'Nombre pièces jointes',
  6: 'Taille totale',
  7: 'Type fichier',
  8: 'Nom fichier'
}

export default function BotManager() {
  const [bots, setBots] = useState([])
  const [filteredBots, setFilteredBots] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [fields, setFields] = useState([])
  const [operatorsMap, setOperatorsMap] = useState({})
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingBot, setEditingBot] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [botOperations, setBotOperations] = useState({})

  const [form, setForm] = useState({
    name: '',
    description: '',
    filter: {
      name: 'Filtre principal',
      required_all: true,
      action: 1,
      rules: [{ field_id: '', operator_id: '', value: '' }]
    }
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        const [botsRes, fieldsRes, usersRes] = await Promise.all([
          api.getBots(),
          api.getFields(),
          api.getAllUsers()
        ])

        const activeBots = (botsRes || []).filter(bot => bot.status !== 3)
        
        setBots(activeBots)
        setFields(fieldsRes || [])
        setUsers(usersRes || [])

        const opsPromises = fieldsRes.map(f => 
          api.getOperatorsForField(f.id).then(ops => ({ [f.id]: ops })).catch(() => ({ [f.id]: [] }))
        )
        const allOps = await Promise.all(opsPromises)
        setOperatorsMap(Object.assign({}, ...allOps))

      } catch (err) {
        console.error('Erreur chargement initial:', err)
        setError('Impossible de charger les données')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const loadOperatorsForField = async (fieldId) => {
    if (!fieldId || operatorsMap[fieldId]) return
    try {
      const ops = await api.getOperatorsForField(fieldId)
      setOperatorsMap(prev => ({ ...prev, [fieldId]: ops }))
    } catch (err) {
      console.error(`Erreur operators pour field ${fieldId}:`, err)
    }
  }

  useEffect(() => {
    const filtered = bots.filter(bot =>
      bot.status !== 3 && (
        bot.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (bot.description && bot.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    )
    setFilteredBots(filtered)
  }, [searchQuery, bots])

  const userMap = users.reduce((acc, u) => {
    acc[u.uid_number || u.id] = u
    return acc
  }, {})

  const getUserInfo = (userId) => {
    const user = userMap[userId]
    if (!user) return { name: 'Inconnu', email: 'Non assigné', color: '#6B7280' }
    
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.email?.split('@')[0]
    return {
      name: name || 'Utilisateur',
      email: user.email || 'Non assigné',
      color: '#003087'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Non défini'
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRuleDisplay = (rule) => {
    const fieldLabel = FIELD_LABELS[rule.field_id] || `Champ ${rule.field_id}`
    const operator = operatorsMap[rule.field_id]?.find(op => op.id == rule.operator_id)
    const operatorLabel = operator?.description || '?'
    
    let value = rule.value?.value
    if (Array.isArray(value)) {
      value = value.join(', ')
    }
    
    return `${fieldLabel} ${operatorLabel} "${value || ''}"`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const assignedUserId = user.uid_number || user.id

      const validRules = form.filter.rules
        .filter(r => r.field_id && String(r.value || '').trim() !== '')
        .map(r => {
          const field = fields.find(f => f.id == r.field_id)
          const operator = operatorsMap[r.field_id]?.find(op => op.id == r.operator_id)

          const isIndexed = field?.is_indexed === true
          const isMany = operator?.many === true
          const fieldType = field?.type || 'string'

          let rawValues = (r.value || '').trim()
            .split(',')
            .map(v => v.trim())
            .filter(v => v.length > 0)

          let finalValue

          if (fieldType === 'number') {
            const numbers = rawValues.map(v => parseFloat(v)).filter(v => !isNaN(v))
            finalValue = isMany ? numbers : (numbers[0] ?? 0)
          } else {
            if (isIndexed) {
              finalValue = rawValues[0] || ''
            } else {
              finalValue = rawValues.length > 0 ? rawValues : ['']
            }
          }

          if (!finalValue || (Array.isArray(finalValue) && finalValue.length === 0)) {
            return null
          }

          const rule = {
            field_id: Number(r.field_id),
            value: {
              value: finalValue
            }
          }

          if (r.operator_id && operator?.id) {
            rule.operator_id = Number(r.operator_id)
          }

          return rule
        })
        .filter(Boolean)

      if (validRules.length === 0) {
        throw new Error("Au moins une règle valide est requise")
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        assigned_user_id: assignedUserId,
        filter: {
          name: form.filter.name.trim(),
          required_all: form.filter.required_all,
          action: form.filter.action,
          rules: validRules
        }
      }

      if (editingBot) {
        await api.updateBot(editingBot.bot_id, payload)
      } else {
        await api.createBot(payload)
      }

      setShowForm(false)
      setEditingBot(null)
      resetForm()

      const freshBots = await api.getBots()
      const activeFreshBots = (freshBots || []).filter(bot => bot.status !== 3)
      setBots(activeFreshBots)

      alert('Bot créé / modifié avec succès !')

    } catch (err) {
      console.error('Erreur complète lors de la sauvegarde :', err)
      const errorDetail = err.response?.data?.detail || 
                         err.response?.data?.error || 
                         err.message || 
                         'Erreur inconnue'
      setError(`Erreur sauvegarde : ${errorDetail}`)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      filter: {
        name: 'Filtre principal',
        required_all: true,
        action: 1,
        rules: [{ field_id: '', operator_id: '', value: '' }]
      }
    })
  }

  const addRule = () => setForm(p => ({
    ...p,
    filter: { ...p.filter, rules: [...p.filter.rules, { field_id: '', operator_id: '', value: '' }] }
  }))

  const removeRule = (i) => setForm(p => ({
    ...p,
    filter: { ...p.filter, rules: p.filter.rules.filter((_, idx) => idx !== i) }
  }))

  const updateRule = (i, key, val) => {
    const rules = [...form.filter.rules]
    
    if (key === 'value') {
      rules[i].value = val
    } else {
      rules[i][key] = val
      if (key === 'field_id') {
        rules[i].operator_id = ''
        rules[i].value = ''
        loadOperatorsForField(val)
      }
    }

    setForm(p => ({ ...p, filter: { ...p.filter, rules } }))
  }

  const openEdit = (bot) => {
    bot.filter?.rules?.forEach(r => loadOperatorsForField(r.field_id))

    setEditingBot(bot)
    setForm({
      name: bot.name || '',
      description: bot.description || bot.descritpion || '',
      filter: {
        name: bot.filter?.name || 'Filtre principal',
        required_all: bot.filter?.required_all ?? true,
        action: bot.filter?.action || 1,
        rules: (bot.filter?.rules || []).map(r => ({
          field_id: String(r.field_id || ''),
          operator_id: r.operator_id ? String(r.operator_id) : '',
          value: Array.isArray(r.value?.value) ? r.value.value.join(', ') : String(r.value?.value || r.value || '')
        }))
      }
    })
    setShowForm(true)
  }

  const handleStartBot = async (bot) => {
    const botId = bot.bot_id
    if (botOperations[botId]) return

    if (bot.status === 1) {
      handleStopBot(bot)
      return
    }

    setBotOperations(prev => ({ ...prev, [botId]: 'starting' }))
    setError('')

    try {
      await api.activateBot(botId)
      const freshBots = await api.getBots()
      setBots((freshBots || []).filter(b => b.status !== 3))
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.error || err.message || 'Erreur inconnue'

      if (status === 409) {
        // Outlook non connecté → lancer le flux OAuth2
        try {
          const authData = await api.startOutlookAuth()
          const authUrl = authData?.auth_url
          if (authUrl) {
            window.open(authUrl, '_blank', 'width=680,height=760,menubar=no,toolbar=no')
            alert(
              "Connexion Outlook requise !\n\n" +
              "→ Une fenêtre s'est ouverte\n" +
              "→ Connectez-vous avec votre compte Microsoft\n" +
              "→ Autorisez l'application\n" +
              "→ Fermez la fenêtre et recliquez sur Démarrer"
            )
          }
        } catch (authErr) {
          setError("Impossible de lancer la connexion Outlook.")
        }
      } else {
        setError("Erreur démarrage bot : " + msg)
      }
    } finally {
      setBotOperations(prev => ({ ...prev, [botId]: null }))
    }
  }

  const handleStopBot = async (bot) => {
    const botId = bot.bot_id

    if (bot.status !== 1) {
      alert("Le bot n'est pas en cours d'exécution.")
      return
    }

    if (botOperations[botId]) return

    setBotOperations(prev => ({ ...prev, [botId]: 'stopping' }))
    setError('')

    try {
      await api.stopBot(botId)
      alert('Bot arrêté avec succès !')
      const freshBots = await api.getBots()
      const activeFreshBots = (freshBots || []).filter(bot => bot.status !== 3)
      setBots(activeFreshBots)
    } catch (err) {
      setError("Erreur arrêt : " + (err.response?.data?.error || "Erreur inconnue"))
    } finally {
      setBotOperations(prev => ({ ...prev, [botId]: null }))
    }
  }

  const handleDeleteBot = async (bot) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le bot "${bot.name}" ?`)) {
      return
    }

    try {
      await api.deleteBot(bot.bot_id)
      alert('Bot supprimé avec succès !')
      const freshBots = await api.getBots()
      const activeFreshBots = (freshBots || []).filter(bot => bot.status !== 3)
      setBots(activeFreshBots)
    } catch (err) {
      setError("Erreur suppression : " + (err.response?.data?.error || "Erreur inconnue"))
    }
  }

  const getInputTypeForRule = (rule) => {
    if (!rule.field_id) return 'text'
    const field = fields.find(f => f.id == rule.field_id)
    if (!field) return 'text'
    const fieldId = Number(rule.field_id)
    if ([3, 4, 7, 8].includes(fieldId)) return 'text'
    const desc = (field.description || '').toLowerCase()
    if (desc.includes('date') || field.type === 'date') return 'date'
    if (desc.includes('nombre') || desc.includes('taille') || field.type === 'number') return 'number'
    return 'text'
  }

  const getPlaceholderForRule = (rule) => {
    if (!rule.field_id) return 'Valeur...'
    const field = fields.find(f => f.id == rule.field_id)
    if (!field) return 'Valeur...'
    const operator = operatorsMap[rule.field_id]?.find(op => op.id == rule.operator_id)
    const isMany = operator?.many || false
    return isMany ? 'Valeurs séparées par virgule' : 'Entrez la valeur'
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Chargement des bots...</p>
      </div>
    )
  }

  return (
    <>
      {/* En-tête avec bouton Nouveau Bot */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            resetForm()
            setEditingBot(null)
            setShowForm(true)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: '#003087',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 48, 135, 0.2)'
          }}
        >
          <Plus size={16} />
          Nouveau Bot
        </motion.button>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div style={{
          padding: '12px',
          background: 'rgba(216, 23, 23, 0.1)',
          color: '#D81717',
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Tableau des bots */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
            <tr style={{ borderBottom: '2px solid #E5EBF9' }}>
              <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: '700', color: '#242D45' }}>Nom</th>
              <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: '700', color: '#242D45' }}>Description</th>
              <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: '700', color: '#242D45' }}>Statut</th>
              <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: '700', color: '#242D45' }}>Créé le</th>
              <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: '700', color: '#242D45' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bots.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: '12px' }}>
                  Aucun bot configuré
                </td>
              </tr>
            ) : (
              bots.map((bot) => {
                const isOperating = !!botOperations[bot.bot_id]
                return (
                  <motion.tr 
                    key={bot.bot_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ borderBottom: '1px solid #F0F3FA' }}
                  >
                    <td style={{ padding: '10px 4px', fontWeight: '600', color: '#010C28' }}>
                      {bot.name || `Bot #${bot.bot_id}`}
                    </td>
                    <td style={{ 
                      padding: '10px 4px', 
                      color: '#6B7280',
                      maxWidth: '200px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {bot.description || '-'}
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: '700',
                        background: STATUS_CONFIG[bot.status]?.bg || '#F0F3FA',
                        color: STATUS_CONFIG[bot.status]?.color || '#6B7280'
                      }}>
                        {STATUS_CONFIG[bot.status]?.label || `Statut ${bot.status}`}
                      </span>
                    </td>
                    <td style={{ padding: '10px 4px', color: '#6B7280' }}>
                      {formatDate(bot.created_at)}
                    </td>
                    <td style={{ padding: '10px 4px' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => bot.status === 1 ? handleStopBot(bot) : handleStartBot(bot)}
                          disabled={isOperating}
                          style={{
                            padding: '6px',
                            background: bot.status === 1 ? 'rgba(216, 23, 23, 0.1)' : 'rgba(95, 204, 128, 0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: isOperating ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isOperating ? 0.5 : 1
                          }}
                          title={bot.status === 1 ? 'Arrêter' : 'Démarrer'}
                        >
                          {bot.status === 1 ? (
                            <Square size={14} style={{ color: '#D81717' }} />
                          ) : (
                            <Play size={14} style={{ color: '#5FCC80' }} />
                          )}
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => openEdit(bot)}
                          style={{
                            padding: '6px',
                            background: 'rgba(0, 48, 135, 0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Modifier"
                        >
                          <Edit3 size={14} style={{ color: '#003087' }} />
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDeleteBot(bot)}
                          style={{
                            padding: '6px',
                            background: 'rgba(216, 23, 23, 0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Supprimer"
                        >
                          <Trash2 size={14} style={{ color: '#D81717' }} />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de création/édition */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 9998,
                backdropFilter: 'blur(4px)'
              }}
            />
            
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px',
              pointerEvents: 'none'
            }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'white',
                  borderRadius: '24px',
                  padding: '32px',
                  maxWidth: '800px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
                  pointerEvents: 'auto'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#010C28' }}>
                    {editingBot ? 'Modifier le Bot' : 'Créer un nouveau Bot'}
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowForm(false)}
                    style={{
                      background: 'rgba(216, 23, 23, 0.1)',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={20} style={{ color: '#D81717' }} />
                  </motion.button>
                </div>

                {error && (
                  <div style={{
                    padding: '16px',
                    background: 'rgba(216, 23, 23, 0.1)',
                    color: '#D81717',
                    borderRadius: '12px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <AlertCircle size={20} />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#242D45' }}>
                      Nom du Bot *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="ex: Bot Factures"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '14px',
                        border: '2px solid #E5EBF9',
                        borderRadius: '12px',
                        outline: 'none',
                        transition: 'border 0.3s'
                      }}
                      onFocus={e => e.target.style.borderColor = '#003087'}
                      onBlur={e => e.target.style.borderColor = '#E5EBF9'}
                    />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#242D45' }}>
                      Description
                    </label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="Description du bot..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '14px',
                        border: '2px solid #E5EBF9',
                        borderRadius: '12px',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: 'Inter, sans-serif'
                      }}
                      onFocus={e => e.target.style.borderColor = '#003087'}
                      onBlur={e => e.target.style.borderColor = '#E5EBF9'}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#010C28' }}>
                      Règles de filtrage
                    </h3>

                    {form.filter.rules.map((rule, i) => {
                      const currentOps = operatorsMap[rule.field_id] || []
                      
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '12px',
                            marginBottom: '16px',
                            alignItems: 'end'
                          }}
                        >
                          <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#242D45' }}>
                              Champ
                            </label>
                            <select
                              value={rule.field_id || ''}
                              onChange={async (e) => {
                                updateRule(i, 'field_id', e.target.value)
                                updateRule(i, 'operator_id', '')
                                if (e.target.value) await loadOperatorsForField(e.target.value)
                              }}
                              required
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                fontSize: '13px',
                                border: '2px solid #E5EBF9',
                                borderRadius: '12px',
                                background: 'white',
                                outline: 'none'
                              }}
                            >
                              <option value="">Sélectionner...</option>
                              {fields.map(f => (
                                <option key={f.id} value={f.id}>
                                  {f.description}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#242D45' }}>
                              Opérateur
                            </label>
                            <select
                              value={rule.operator_id || ''}
                              onChange={e => updateRule(i, 'operator_id', e.target.value)}
                              required={currentOps.length > 0}
                              disabled={currentOps.length === 0}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                fontSize: '13px',
                                border: '2px solid #E5EBF9',
                                borderRadius: '12px',
                                background: 'white',
                                outline: 'none',
                                opacity: currentOps.length === 0 ? 0.6 : 1
                              }}
                            >
                              <option value="">Sélectionner...</option>
                              {currentOps.map(op => (
                                <option key={op.id} value={op.id}>
                                  {op.description}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#242D45' }}>
                              Valeur(s)
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type={getInputTypeForRule(rule)}
                                value={rule.value || ''}
                                onChange={e => updateRule(i, 'value', e.target.value)}
                                required
                                placeholder={getPlaceholderForRule(rule)}
                                style={{
                                  flex: 1,
                                  padding: '12px 16px',
                                  fontSize: '13px',
                                  border: '2px solid #E5EBF9',
                                  borderRadius: '12px',
                                  outline: 'none'
                                }}
                              />
                              {form.filter.rules.length > 1 && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  type="button"
                                  onClick={() => removeRule(i)}
                                  style={{
                                    padding: '12px',
                                    background: 'rgba(216, 23, 23, 0.1)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 size={16} style={{ color: '#D81717' }} />
                                </motion.button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}

                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={addRule}
                      style={{
                        color: '#003087',
                        fontWeight: '700',
                        background: 'rgba(0, 48, 135, 0.1)',
                        border: '2px solid #003087',
                        borderRadius: '12px',
                        padding: '12px 24px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        margin: '0 auto'
                      }}
                    >
                      <Plus size={18} />
                      Ajouter une règle
                    </motion.button>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'flex-end', 
                    gap: '16px', 
                    marginTop: '24px',
                    paddingTop: '24px',
                    borderTop: '2px solid #E5EBF9'
                  }}>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={() => setShowForm(false)}
                      style={{
                        padding: '12px 32px',
                        background: '#E5EBF9',
                        color: '#242D45',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: '700',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      Annuler
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={saving}
                      style={{
                        padding: '12px 40px',
                        background: '#003087',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: '800',
                        fontSize: '14px',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                        boxShadow: '0 8px 24px rgba(0, 48, 135, 0.3)'
                      }}
                    >
                      {saving ? 'Enregistrement...' : (editingBot ? 'Enregistrer' : 'Créer le Bot')}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

    </>
  )
}