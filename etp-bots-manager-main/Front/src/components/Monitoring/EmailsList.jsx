import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Search, RefreshCw, Eye, FileText, X, 
  ChevronLeft, ChevronRight, AlertCircle, Clock, User
} from 'lucide-react';
import { api } from '../../services/api';

export default function EmailsList() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);

  const pageSize = 10;

  const loadEmails = async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAllEmails(p, pageSize);
      const data = res.results || res.data || res || [];
      
      const formatted = data.map(email => ({
        id: email._id || email.gmail_message_id,
        gmail_message_id: email.gmail_message_id,
        from: email.from || 'Inconnu',
        to: email.to || '—',
        subject: email.subject || '(sans objet)',
        date: email.date || email.received_at || '',
        received_at: email.received_at || '',
        has_attachment: !!email.has_attachment,
        body_html: email.body_html || '',
        body_text: email.body_text || '',
        snippet: email.snippet || '',
        labels: email.labels || [],
        thread_id: email.thread_id || '',
      }));

      setEmails(formatted);
      setTotalPages(res.totalPages || Math.ceil((res.count || data.length) / pageSize) || 1);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, [page]);

  const filteredEmails = useMemo(() => {
    if (!search.trim()) return emails;
    const term = search.toLowerCase();
    return emails.filter(e =>
      e.from.toLowerCase().includes(term) ||
      e.subject.toLowerCase().includes(term) ||
      (e.snippet && e.snippet.toLowerCase().includes(term))
    );
  }, [emails, search]);

  const openDetails = (email) => setSelectedEmail(email);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
      
      if (diffHours < 1) {
        return 'À l\'instant';
      } else if (diffHours < 24) {
        return `Il y a ${diffHours}h`;
      } else {
        return date.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {/* MODAL DÉTAILS */}
      <AnimatePresence>
        {selectedEmail && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEmail(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(1, 12, 40, 0.9)',
                zIndex: 9998,
                backdropFilter: 'blur(8px)'
              }}
            />

            <div style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{
                  background: 'white',
                  borderRadius: '20px',
                  padding: '32px',
                  maxWidth: '800px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 40px 120px rgba(0,0,0,0.3)',
                  border: '1px solid #E5EBF9'
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  marginBottom: '24px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      background: '#003087',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Mail size={24} style={{ color: 'white' }} />
                    </div>
                    <div>
                      <h2 style={{ 
                        margin: 0, 
                        fontSize: '24px', 
                        fontWeight: '700', 
                        color: '#010C28',
                        lineHeight: 1.3
                      }}>
                        {selectedEmail.subject || '(sans objet)'}
                      </h2>
                      <p style={{ 
                        margin: '8px 0 0', 
                        fontSize: '14px', 
                        color: '#6B7280',
                        fontWeight: '500'
                      }}>
                        De : {selectedEmail.from}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    style={{
                      background: '#F8FAFF',
                      border: '1px solid #E5EBF9',
                      borderRadius: '10px',
                      padding: '10px',
                      cursor: 'pointer',
                      color: '#242D45'
                    }}
                  >
                    <X size={24} />
                  </button>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gap: '16px', 
                  marginBottom: '24px', 
                  fontSize: '14px', 
                  color: '#242D45',
                  background: '#F8FAFF',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #E5EBF9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#010C28', minWidth: '80px' }}>À :</strong>
                    <span>{selectedEmail.to}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#010C28', minWidth: '80px' }}>Reçu le :</strong>
                    <span>{formatDate(selectedEmail.received_at || selectedEmail.date)}</span>
                  </div>
                  {selectedEmail.has_attachment && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} color="#003087" />
                      <strong style={{ color: '#003087' }}>Contient des pièces jointes</strong>
                    </div>
                  )}
                </div>

                <div style={{
                  padding: '24px',
                  background: '#F8FAFF',
                  borderRadius: '12px',
                  border: '1px solid #E5EBF9',
                  marginBottom: '24px',
                  minHeight: '200px',
                  lineHeight: '1.6',
                  color: '#242D45'
                }}>
                  <div dangerouslySetInnerHTML={{ 
                    __html: selectedEmail.body_html || 
                    selectedEmail.body_text || 
                    '<p style="color:#6B7280;">Aucun contenu disponible</p>' 
                  }} />
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: '12px',
                  paddingTop: '24px',
                  borderTop: '1px solid #E5EBF9'
                }}>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    style={{
                      padding: '12px 32px',
                      background: '#003087',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 20px rgba(0, 48, 135, 0.2)'
                    }}
                  >
                    Fermer
                  </button>
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
        boxShadow: '0 4px 20px rgba(0, 12, 40, 0.04)'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '28px',
          borderBottom: '1px solid #E5EBF9',
          background: 'linear-gradient(135deg, #F8FAFF 0%, #FFFFFF 100%)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                background: '#003087',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Mail size={22} style={{ color: 'white' }} />
              </div>
              <div>
                <h3 style={{ 
                  margin: '0 0 4px 0', 
                  fontSize: '22px', 
                  fontWeight: '700', 
                  color: '#010C28'
                }}>
                  Emails Reçus
                </h3>
                <p style={{ 
                  margin: 0, 
                  color: '#6B7280', 
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''} trouvé{filteredEmails.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ 
                  position: 'absolute', 
                  left: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#6B7280' 
                }} />
                <input
                  type="text"
                  placeholder="Rechercher expéditeur ou sujet..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    padding: '12px 16px 12px 48px',
                    border: '2px solid #E5EBF9',
                    borderRadius: '12px',
                    width: '280px',
                    fontSize: '14px',
                    background: 'white',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={e => e.target.style.borderColor = '#003087'}
                  onBlur={e => e.target.style.borderColor = '#E5EBF9'}
                />
              </div>

              {/* Refresh Button - Vert */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => loadEmails(page)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: '#5FCC80',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(95, 204, 128, 0.3)'
                }}
              >
                <RefreshCw size={16} />
                Actualiser
              </motion.button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '16px 28px',
            background: 'rgba(216, 23, 23, 0.1)',
            color: '#D81717',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontWeight: '600',
            fontSize: '14px'
          }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Liste des emails */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: '#F8FAFF',
          minHeight: '400px'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '300px',
              color: '#242D45'
            }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                border: '3px solid #E5EBF9', 
                borderTop: '3px solid #003087', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite',
                marginBottom: '20px'
              }} />
              <p style={{ fontSize: '16px', fontWeight: '600' }}>
                Chargement des emails...
              </p>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '300px',
              color: '#242D45',
              textAlign: 'center',
              padding: '24px'
            }}>
              <Mail size={48} style={{ opacity: 0.5, marginBottom: '20px' }} />
              <p style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0' }}>
                {search ? 'Aucun résultat' : 'Aucun email'}
              </p>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                {search ? 'Modifiez votre recherche' : 'Les emails apparaîtront ici'}
              </p>
            </div>
          ) : (
            <div style={{ padding: '24px' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
              }}>
                <thead>
                  <tr style={{ background: 'rgba(229, 235, 249, 0.3)', borderBottom: '2px solid #E5EBF9' }}>
                    <th style={{ padding: '20px 24px', textAlign: 'left', fontWeight: '700', color: '#010C28', fontSize: '14px' }}>
                      Expéditeur
                    </th>
                    <th style={{ padding: '20px 24px', textAlign: 'left', fontWeight: '700', color: '#010C28', fontSize: '14px' }}>
                      Sujet
                    </th>
                    <th style={{ padding: '20px 24px', textAlign: 'left', fontWeight: '700', color: '#010C28', fontSize: '14px' }}>
                      Date
                    </th>
                    <th style={{ padding: '20px 24px', textAlign: 'center', fontWeight: '700', color: '#010C28', fontSize: '14px' }}>
                      PJ
                    </th>
                    <th style={{ padding: '20px 24px', textAlign: 'right', fontWeight: '700', color: '#010C28', fontSize: '14px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmails.map((email, index) => (
                    <motion.tr
                      key={email.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: 'white'
                      }}
                      whileHover={{ backgroundColor: 'rgba(229, 235, 249, 0.1)' }}
                    >
                      <td style={{ padding: '20px 24px', fontWeight: '600', color: '#242D45' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            background: 'rgba(0, 48, 135, 0.1)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#003087',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                            {email.from?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span>{email.from}</span>
                        </div>
                      </td>
                      <td style={{ padding: '20px 24px', color: '#010C28' }}>
                        {email.subject}
                      </td>
                      <td style={{ padding: '20px 24px', color: '#6B7280' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} />
                          {formatDate(email.received_at)}
                        </div>
                      </td>
                      <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                        {email.has_attachment ? (
                          <FileText size={20} color="#003087" />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => openDetails(email)}
                          style={{
                            padding: '10px 20px',
                            background: 'rgba(0, 48, 135, 0.1)',
                            border: '1px solid rgba(0, 48, 135, 0.2)',
                            color: '#003087',
                            borderRadius: '10px',
                            fontWeight: '600',
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <Eye size={16} />
                          Détails
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: '20px 28px',
            borderTop: '1px solid #E5EBF9',
            background: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: '500' }}>
                Page {page} sur {totalPages}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <motion.button
                whileHover={{ scale: page === 1 ? 1 : 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{
                  padding: '10px 20px',
                  background: page === 1 ? '#F8FAFF' : '#003087',
                  color: page === 1 ? '#6B7280' : 'white',
                  border: page === 1 ? '1px solid #E5EBF9' : 'none',
                  borderRadius: '10px',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                <ChevronLeft size={18} />
                Précédent
              </motion.button>

              <motion.button
                whileHover={{ scale: page === totalPages ? 1 : 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{
                  padding: '10px 20px',
                  background: page === totalPages ? '#F8FAFF' : '#003087',
                  color: page === totalPages ? '#6B7280' : 'white',
                  border: page === totalPages ? '1px solid #E5EBF9' : 'none',
                  borderRadius: '10px',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                Suivant
                <ChevronRight size={18} />
              </motion.button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}