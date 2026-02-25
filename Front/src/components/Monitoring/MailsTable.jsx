import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mail, Search, RefreshCw, X, ChevronDown, ChevronUp,
  AlertCircle, Clock, User, FileText, CheckCircle, Calendar,
  Filter, Paperclip, ChevronRight
} from 'lucide-react'
import { api } from '../../services/api'

export default function MailsTable() {
  const [emails, setEmails] = useState([])
  const [filteredEmails, setFilteredEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [dateFilter, setDateFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  // Charger les emails
  const loadEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.getAllEmails(1, 50)
      const formattedEmails = (response.results || []).map(email => ({
        id: email.gmail_message_id || email.id,
        from: email.from || email.sender || 'Expéditeur inconnu',
        subject: email.subject || 'Sans objet',
        date: email.date || email.received_at,
        body: email.body || `Email reçu le ${new Date(email.date || email.received_at).toLocaleDateString('fr-FR')}.`,
      }))
      setEmails(formattedEmails)
    } catch (err) {
      console.error('Erreur chargement emails:', err)
      setError('Impossible de charger les emails')
      // Mock data
      const mockEmails = Array.from({ length: 8 }, (_, i) => ({
        id: `mock-${i}`,
        from: `client${i}@entreprise.com`,
        subject: i % 3 === 0 ? 'Facture mensuelle' : 'Demande de devis',
        date: new Date(Date.now() - i * 86400000).toISOString(),
        body: `Contenu de l'email ${i + 1}.`,
      }))
      setEmails(mockEmails)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadEmails() }, [])

  useEffect(() => {
    let result = [...emails]
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(email => 
        email.from.toLowerCase().includes(term) ||
        email.subject.toLowerCase().includes(term)
      )
    }
    
    if (dateFilter !== 'all') {
      const now = new Date()
      const filterDate = new Date()
      switch(dateFilter) {
        case 'today': filterDate.setDate(now.getDate() - 1); break
        case 'week': filterDate.setDate(now.getDate() - 7); break
        case 'month': filterDate.setMonth(now.getMonth() - 1); break
      }
      result = result.filter(email => new Date(email.date) >= filterDate)
    }
    
    result.sort((a, b) => sortBy === 'newest' 
      ? new Date(b.date) - new Date(a.date)
      : new Date(a.date) - new Date(b.date)
    )
    
    setFilteredEmails(showAll ? result : result.slice(0, 3))
  }, [emails, searchTerm, showAll, dateFilter, sortBy])

  const getDateStats = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    return {
      today: emails.filter(e => new Date(e.date) >= today).length,
      thisWeek: emails.filter(e => new Date(e.date) >= weekAgo).length,
    }
  }

  const dateStats = getDateStats()

  const viewEmailDetails = (email) => {
    setSelectedEmail(email)
    setShowDetails(true)
  }

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60))
      if (diffHours < 1) return 'À l\'instant'
      if (diffHours < 24) return `Il y a ${diffHours}h`
      if (diffHours < 48) return 'Hier'
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    } catch { return '--' }
  }

  const EmailItem = ({ email, index }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        background: 'linear-gradient(135deg, rgba(0, 48, 135, 0.04) 0%, rgba(0, 48, 135, 0.01) 100%)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '12px',
        cursor: 'pointer',
        border: '1.5px solid rgba(0, 48, 135, 0.15)',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.04)',
        transition: 'all 0.3s',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 12, 40, 0.1)'
        e.currentTarget.style.borderColor = '#003087'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.04)'
        e.currentTarget.style.borderColor = 'rgba(0, 48, 135, 0.15)'
      }}
      onClick={() => viewEmailDetails(email)}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '4px',
        height: '100%',
        background: 'linear-gradient(to bottom, #003087, #1746D9)',
        borderRadius: '16px 0 0 16px'
      }} />
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        style={{
          position: 'absolute',
          top: '22px',
          left: '-6px',
          width: '10px',
          height: '10px',
          background: '#003087',
          borderRadius: '50%',
          boxShadow: '0 0 0 3px rgba(0, 48, 135, 0.2)'
        }}
      />
      
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <motion.div
          whileHover={{ rotate: 5, scale: 1.05 }}
          style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #003087 0%, #1746D9 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 8px 24px rgba(0, 48, 135, 0.2)'
          }}
        >
          <Mail size={20} style={{ color: 'white' }} />
        </motion.div>
        
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <p style={{ 
              margin: 0, 
              fontSize: '17px', 
              fontWeight: '700', 
              color: '#003087',
              flex: 1,
              background: 'linear-gradient(90deg, #003087 0%, #1746D9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {email.subject}
            </p>
            
            <motion.span
              whileHover={{ scale: 1.05 }}
              style={{
                fontSize: '13px',
                color: '#003087',
                background: 'rgba(0, 48, 135, 0.1)',
                padding: '6px 10px',
                borderRadius: '8px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid rgba(0, 48, 135, 0.2)'
              }}
            >
              <Clock size={12} />
              {formatDate(email.date)}
            </motion.span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: 'rgba(0, 48, 135, 0.05)',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 48, 135, 0.1)'
            }}>
              <User size={14} style={{ color: '#003087' }} />
              <span style={{ fontSize: '14px', color: '#003087', fontWeight: '500' }}>
                {email.from.length > 25 ? email.from.substring(0, 25) + '...' : email.from}
              </span>
            </div>
          </div>

          {/* Prévisualisation du contenu */}
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0, 48, 135, 0.1)' }}>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#6B7280',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {email.body}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '8px', color: '#003087', fontSize: '12px', fontWeight: '600' }}>
              <span style={{ opacity: 0.7 }}>Cliquer pour lire</span>
              <ChevronRight size={12} style={{ marginLeft: '4px' }} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )

  return (
    <>
      {/* Modal détail simplifié */}
      <AnimatePresence>
        {showDetails && selectedEmail && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetails(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(1, 12, 40, 0.92)',
                zIndex: 9998,
                backdropFilter: 'blur(8px)',
              }}
            />
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                style={{
                  background: 'white',
                  borderRadius: '20px',
                  width: '100%',
                  maxWidth: '700px',
                  maxHeight: '85vh',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 40px 100px rgba(0,0,0,0.3)',
                  border: '1px solid #E5EBF9',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ padding: '24px', borderBottom: '1px solid #E5EBF9', background: '#F8FAFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '52px', height: '52px', background: '#003087', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Mail size={24} style={{ color: 'white' }} />
                      </div>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700', color: '#010C28' }}>
                          {selectedEmail.subject}
                        </h3>
                        <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
                          {selectedEmail.from}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setShowDetails(false)} style={{ background: 'white', border: '1px solid #E5EBF9', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
                      <X size={20} style={{ color: '#6B7280' }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#6B7280' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={14} />
                      {new Date(selectedEmail.date).toLocaleDateString('fr-FR', { 
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                      })}
                    </span>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                  <div style={{ 
                    background: '#F8FAFF', 
                    padding: '20px', 
                    borderRadius: '12px',
                    marginBottom: '16px',
                    fontSize: '14px',
                    color: '#242D45',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid #E5EBF9'
                  }}>
                    {selectedEmail.body}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setShowDetails(false)}
                      style={{
                        padding: '10px 24px',
                        background: '#003087',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Conteneur principal */}
      <div style={{
        background: 'white',
        borderRadius: '20px',
        border: '1px solid #E5EBF9',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #E5EBF9', background: '#F8FAFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: '#003087', borderRadius: '12px', padding: '12px' }}>
                <Mail size={24} style={{ color: 'white' }} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '800', color: '#010C28' }}>
                  Emails Reçus
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>
                    <span style={{ fontWeight: '700', color: '#003087' }}>{emails.length}</span> emails • {showAll ? 'Tous affichés' : '3 affichés'}
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ padding: '4px 8px', background: 'rgba(0, 48, 135, 0.1)', color: '#003087', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                      <Calendar size={10} style={{ marginRight: '4px' }} />
                      {dateStats.today} aujourd'hui
                    </span>
                    <span style={{ padding: '4px 8px', background: 'rgba(227, 146, 12, 0.1)', color: '#E3920C', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                      <Clock size={10} style={{ marginRight: '4px' }} />
                      {dateStats.thisWeek} cette semaine
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => loadEmails()}
                style={{
                  background: '#5FCC80',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  border: 'none'
                }}
              >
                <RefreshCw size={16} />
                Actualiser
              </button>
            </div>
          </div>

          {/* Recherche et filtres */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#003087' }} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 44px',
                  fontSize: '14px',
                  border: '1px solid #E5EBF9',
                  borderRadius: '10px',
                  background: 'white',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#003087', fontWeight: '600', fontSize: '13px' }}>
                <Filter size={14} />
                Filtres:
              </div>
              
              <div style={{ display: 'flex', background: '#F8FAFF', padding: '4px', borderRadius: '10px', border: '1px solid #E5EBF9' }}>
                {['all', 'today', 'week', 'month'].map((key) => (
                  <button
                    key={key}
                    onClick={() => setDateFilter(key)}
                    style={{
                      padding: '6px 12px',
                      background: dateFilter === key ? '#003087' : 'transparent',
                      color: dateFilter === key ? 'white' : '#6B7280',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {key === 'all' ? 'Toutes dates' : 
                     key === 'today' ? 'Aujourd\'hui' : 
                     key === 'week' ? '7 jours' : '30 jours'}
                  </button>
                ))}
              </div>
              
              <div style={{ display: 'flex', background: '#F8FAFF', padding: '4px', borderRadius: '10px', border: '1px solid #E5EBF9' }}>
                {['newest', 'oldest'].map((key) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    style={{
                      padding: '6px 12px',
                      background: sortBy === key ? '#003087' : 'transparent',
                      color: sortBy === key ? 'white' : '#6B7280',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {key === 'newest' ? 'Plus récents' : 'Plus anciens'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Liste emails */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#F8FAFF' }}>
          <AnimatePresence mode="wait">
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid #E5EBF9', borderTop: '3px solid #003087', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: '14px', marginTop: '12px', color: '#6B7280' }}>Chargement...</p>
              </div>
            ) : error ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#D81717' }}>
                <AlertCircle size={32} style={{ marginBottom: '12px' }} />
                <p style={{ fontSize: '14px' }}>{error}</p>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                <Mail size={40} style={{ color: '#6B7280', marginBottom: '12px' }} />
                <p style={{ fontSize: '14px', color: '#6B7280' }}>
                  {searchTerm ? 'Aucun résultat' : 'Aucun email'}
                </p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px', color: '#6B7280', fontSize: '13px' }}>
                  {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''} trouvé{filteredEmails.length !== 1 ? 's' : ''}
                </div>
                {filteredEmails.map((email, index) => (
                  <EmailItem key={email.id} email={email} index={index} />
                ))}
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Bouton Voir plus/moins */}
        {emails.length > 3 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #E5EBF9', background: 'white' }}>
            <button
              onClick={() => setShowAll(!showAll)}
              style={{
                background: '#E5EBF9',
                color: '#242D45',
                padding: '10px 24px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                justifyContent: 'center',
                border: 'none'
              }}
            >
              {showAll ? (
                <>
                  <ChevronUp size={18} />
                  Voir moins (afficher 3 emails)
                </>
              ) : (
                <>
                  <ChevronDown size={18} />
                  Voir plus ({emails.length - 3} autres emails)
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <style jsx="true">{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}