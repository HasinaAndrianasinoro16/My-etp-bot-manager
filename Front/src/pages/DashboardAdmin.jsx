import { motion } from 'framer-motion'
import { Activity, Bot, Download, Mail, Users, Wifi, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import BotManager from '../components/Bot/BotManager'
import { api } from '../services/api'

import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS,
  Filler, Legend, LinearScale, LineElement, PointElement, Title, Tooltip
} from 'chart.js'
import { Pie } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, ArcElement)

// ========================= BOT LOG CARD =========================
function BotLogCard({ bot }) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const isActive   = bot.status === 1
  const accent     = isActive ? '#5FCC80' : '#D81717'
  const accentBg   = isActive ? 'rgba(95,204,128,0.12)' : 'rgba(216,23,23,0.1)'
  const borderClr  = isActive ? 'rgba(95,204,128,0.3)'  : 'rgba(216,23,23,0.18)'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Appel vers GET /bots/{id}/emails/ — filtre par règle expéditeur du bot
        const res = await api.getBotEmails(bot.bot_id, 1, 1000)
        setEmails(res.results || [])
        setTotal(res.count || 0)
      } catch (err) {
        console.error('Erreur chargement emails bot:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [bot.bot_id])

  const exportLogs = () => {
    const fmt2 = (dt) => dt ? new Date(dt).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) : '-'

    const header = [
      `=== LOGS BOT : ${(bot.name || `Bot #${bot.bot_id || bot.id}`).toUpperCase()} ===`,
      `Date export : ${fmt2(new Date())}`,
      `Total emails traités : ${total}`,
      '',
    ]

    const body = emails.map((email, i) => [
      `--- Email #${i + 1} ---`,
      `Sujet         : ${email.subject || '(sans sujet)'}`,
      `Expéditeur    : ${email.from_name ? `${email.from_name} <${email.from_email || ''}>` : (email.from_email || email.from || '-')}`,
      `Reçu le       : ${fmt2(email.received_at || email.date || email.received_date)}`,
      `Pièce jointe  : ${email.has_attachment ? `Oui (${(email.attachments || []).length})` : 'Non'}`,
      '',
    ].join('\n'))

    const content = [...header, ...body].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs_${(bot.name || `bot_${bot.bot_id || bot.id}`).replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmt = (dt) => dt
    ? new Date(dt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-'

  return (
    <div style={{
      border: `1.5px solid ${borderClr}`,
      borderRadius: '12px',
      overflow: 'hidden',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header bot ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: 'white',
        borderBottom: `1px solid ${borderClr}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bot size={14} color={accent} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#010C28' }}>
              {bot.name || `Bot #${bot.bot_id || bot.id}`}
            </div>
            <div style={{ fontSize: '9px', color: '#9CA3AF', marginTop: '1px' }}>
              {loading ? 'Chargement...' : `${total} email${total > 1 ? 's' : ''} traite${total > 1 ? 's' : ''}`}
              {bot.updated_at ? `  ·  Mis à jour ${fmt(bot.updated_at)}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ padding: '3px 9px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', background: accentBg, color: accent }}>
            {isActive ? 'Actif' : 'Inactif'}
          </span>
          <button
            onClick={exportLogs}
            disabled={loading || emails.length === 0}
            title="Exporter les logs en .txt"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '700',
              background: loading || emails.length === 0 ? 'rgba(107,114,128,0.08)' : 'rgba(0,48,135,0.08)',
              color: loading || emails.length === 0 ? '#9CA3AF' : '#003087',
              border: 'none', cursor: loading || emails.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!loading && emails.length > 0) e.currentTarget.style.background = 'rgba(0,48,135,0.15)' }}
            onMouseLeave={e => { if (!loading && emails.length > 0) e.currentTarget.style.background = 'rgba(0,48,135,0.08)' }}
          >
            <Download size={10} />
            .txt
          </button>
        </div>
      </div>

      {/* ── Liste emails — scrollable ── */}
      <div style={{ overflowY: 'auto', maxHeight: '260px', background: '#FAFBFF' }}>
        {loading ? (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#9CA3AF' }}>
            Chargement des logs...
          </div>
        ) : emails.length === 0 ? (
          <div style={{ padding: '18px', textAlign: 'center', fontSize: '11px', color: '#9CA3AF' }}>
            <Mail size={20} style={{ opacity: 0.2, display: 'block', margin: '0 auto 6px' }} />
            Aucun email traité
          </div>
        ) : emails.map((email, i) => {
          // raw_imap_emails fields: imap_uid, subject, from_email, date, received_at, has_attachment, body_text
          const fromEmail = email.from_email || email.from || '-'
          const dateVal   = email.received_at || email.date || email.received_date
          return (
            <div key={email.imap_uid || email.id || i} style={{
              padding: '10px 14px',
              borderBottom: i < emails.length - 1 ? '1px solid #EEF1F9' : 'none',
              background: 'white',
            }}>
              {/* Ligne 1 : numéro + sujet */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '5px' }}>
                <span style={{ fontSize: '9px', color: '#C4CAD9', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>
                  #{i + 1}
                </span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#010C28', flex: 1, wordBreak: 'break-word' }}>
                  {email.subject || '(sans sujet)'}
                </span>
                <span style={{ padding: '2px 6px', borderRadius: '5px', fontSize: '9px', fontWeight: '600', background: 'rgba(0,48,135,0.08)', color: '#003087', flexShrink: 0 }}>
                  filtré
                </span>
              </div>

              {/* Grille détails */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', fontSize: '10px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#9CA3AF', fontWeight: '600' }}>De : </span>
                  <span style={{ color: '#374151', fontWeight: '600' }}>{fromEmail}</span>
                </div>
                <div>
                  <span style={{ color: '#9CA3AF', fontWeight: '600' }}>Reçu le : </span>
                  <span style={{ color: '#374151' }}>{fmt(dateVal)}</span>
                </div>
                <div>
                  <span style={{ color: '#9CA3AF', fontWeight: '600' }}>PJ : </span>
                  <span style={{ color: email.has_attachment ? '#E3920C' : '#6B7280', fontWeight: email.has_attachment ? '700' : '400' }}>
                    {email.has_attachment ? 'Oui' : 'Non'}
                  </span>
                </div>
                {email.imap_uid && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: '#9CA3AF', fontWeight: '600' }}>UID : </span>
                    <span style={{ color: '#C4CAD9', fontSize: '9px' }}>{email.imap_uid}</span>
                  </div>
                )}
              </div>

              {/* Aperçu corps */}
              {email.body_text && (
                <div style={{
                  marginTop: '6px', padding: '6px 8px',
                  background: '#F5F7FC', borderRadius: '6px',
                  fontSize: '10px', color: '#6B7280', fontStyle: 'italic',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  maxHeight: '50px', overflow: 'hidden',
                }}>
                  {email.body_text.slice(0, 200)}{email.body_text.length > 200 ? '…' : ''}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ========================= DASHBOARD ADMIN =========================
export default function DashboardAdmin() {
  const [stats, setStats] = useState({
    totalBots: 0, activeBots: 0, users: 0,
    emailsToday: 0, emailsTotal: 0, emailsProcessed: 0, emailsPending: 0,
    systemHealth: 'Excellent', uptime: '99.9%',
    activeUsers: 0, avgEmailsPerDay: 0, botSuccessRate: 0
  })
  const [users, setUsers] = useState([])
  const [bots, setBots] = useState([])
  const [allEmails, setAllEmails] = useState([])
  const [outlookStatus, setOutlookStatus] = useState({ connected: false, email: null })

  const loadStats = useCallback(async () => {
    try {
      const [botsRes, usersRes, emailsRes, outlookRes] = await Promise.all([
        api.getBots().catch(() => []),
        api.getAllUsers().catch(() => []),
        api.getAllEmails(1, 2000).catch(() => ({ results: [] })),
        api.getOutlookStatus().catch(() => ({ connected: false, email: null }))
      ])
      setOutlookStatus(outlookRes || { connected: false, email: null })

      let botsList = Array.isArray(botsRes) ? botsRes : (botsRes?.results || botsRes?.data || [])
      const filteredBots = botsList.filter(bot => bot.status !== 3)
      const activeBotsCount = filteredBots.filter(b => b?.status === 1).length
      setBots(filteredBots)

      let usersList = Array.isArray(usersRes) ? usersRes : (usersRes?.results || usersRes?.data || [])
      setUsers(usersList)
      const activeUsersCount = usersList.filter(u => {
        const last = u?.last_login || u?.updated_at
        return last && ((new Date()) - new Date(last)) / (1000 * 60 * 60) < 24
      }).length

      let allEmailsData = Array.isArray(emailsRes) ? emailsRes : (emailsRes?.results || emailsRes?.data || [])
      setAllEmails(allEmailsData)
      const processedEmails = allEmailsData.filter(e => e?.processed || e?.status === 'processed').length
      const pendingEmails = allEmailsData.filter(e => !e?.processed || e?.status === 'pending').length
      const todayStr = new Date().toISOString().split('T')[0]
      const emailsTodayCount = allEmailsData.filter(e => {
        const d = e?.received_at || e?.date
        return d && new Date(d).toISOString().split('T')[0] === todayStr
      }).length

      setStats({
        totalBots: filteredBots.length, activeBots: activeBotsCount,
        users: usersList.length, emailsToday: emailsTodayCount,
        emailsTotal: allEmailsData.length, emailsProcessed: processedEmails,
        emailsPending: pendingEmails,
        systemHealth: activeBotsCount > 0 && pendingEmails < 10 ? 'Excellent' : 'Attention',
        uptime: '99.9%', activeUsers: activeUsersCount,
        avgEmailsPerDay: allEmailsData.length ? Math.round(allEmailsData.length / Math.max(1, 1)) : 0,
        botSuccessRate: allEmailsData.length ? Math.round((processedEmails / allEmailsData.length) * 100) : 0
      })
    } catch (err) {
      console.error('Erreur loadStats:', err)
    }
  }, [])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [loadStats])

  const emailPieData = useMemo(() => ({
    labels: ['Emails traités', 'Emails en attente'],
    datasets: [{
      label: 'Emails',
      data: [stats.emailsProcessed, stats.emailsPending],
      backgroundColor: ['#5FCC80', '#E3920C'],
      borderColor: ['#ffffff', '#ffffff'],
      borderWidth: 2
    }]
  }), [stats.emailsProcessed, stats.emailsPending])

  const emailPieOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 11 }, color: '#242D45', padding: 8 } },
      tooltip: {
        callbacks: {
          label: function (context) {
            const value = context.raw
            const total = stats.emailsProcessed + stats.emailsPending
            const pct = total ? ((value / total) * 100).toFixed(1) : 0
            return `${context.label}: ${value} (${pct}%)`
          }
        }
      }
    }
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#E5EBF9', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', background: '#E5EBF9' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', margin: 0 }}>Tableau de bord Admin</h1>
      </div>

      {/* Contenu principal */}
      <div style={{ flex: 1, padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>

        {/* Cartes statistiques */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {[
            { title: 'Bots', value: stats.totalBots, extra: `${stats.activeBots} actifs`, description: `Taux de succès: ${stats.botSuccessRate}%`, icon: Bot, color: '#003087' },
            { title: 'Emails', value: stats.emailsToday, extra: `${stats.emailsProcessed} traités • ${stats.emailsPending} en attente`, icon: Mail, color: '#E3920C' },
            { title: 'Utilisateurs', value: stats.users, extra: `${stats.activeUsers} actifs`, icon: Users, color: '#1746D9' },
            { title: 'Santé système', value: stats.systemHealth, extra: `Uptime: ${stats.uptime}`, icon: Activity, color: stats.systemHealth === 'Excellent' ? '#5FCC80' : '#E3920C' },
            { title: 'Réseau', value: outlookStatus.connected ? 'Connecté' : 'Hors ligne', extra: outlookStatus.connected ? (outlookStatus.email || 'Boîte connectée') : 'Boîte non connectée', icon: outlookStatus.connected ? Wifi : WifiOff, color: outlookStatus.connected ? '#5FCC80' : '#D81717' }
          ].map((card, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02 }}
              style={{ background: 'white', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: card.color, borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <card.icon size={18} color="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 500, color: '#242D45', opacity: 0.8 }}>{card.title}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 700, color: '#010C28' }}>{card.value || 0}</p>
                  {card.extra && <p style={{ margin: '2px 0 0', fontSize: '10px', fontWeight: 600, color: '#5FCC80', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.extra}</p>}
                  {card.description && <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#6B7280' }}>{card.description}</p>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Ligne 2 */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', overflow: 'hidden', minHeight: 0 }}>

          {/* Colonne gauche */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ flex: 1, background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <BotManager />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              style={{ flex: 1, background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 12px 0', color: '#010C28' }}>Agents ({users.length})</h3>
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                    <tr style={{ borderBottom: '2px solid #E5EBF9' }}>
                      <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: '700', color: '#242D45' }}>Agent</th>
                      <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: '700', color: '#242D45' }}>Email</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: '700', color: '#242D45' }}>Date</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: '700', color: '#242D45' }}>Nb</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: '12px' }}>Aucun agent</td></tr>
                    ) : users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                        <td style={{ padding: '10px 4px', fontWeight: '600', color: '#010C28' }}>
                          {u.name || (u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username || 'Inconnu')}
                        </td>
                        <td style={{ padding: '10px 4px', color: '#6B7280' }}>{u.email || '-'}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#6B7280' }}>
                          {u.last_submission ? new Date(u.last_submission).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', fontWeight: '600', color: '#003087' }}>{u.submission_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>

          {/* Colonne droite */}
          <div style={{ display: 'flex', gap: '16px', overflow: 'hidden' }}>

            {/* Graphique */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              style={{ flex: 1, background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 12px 0', color: '#010C28' }}>Emails traités vs en attente</h3>
              <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <Pie data={emailPieData} options={emailPieOptions} />
              </div>
            </motion.div>

            {/* Logs Bots */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              style={{ flex: 1, background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 12px 0', color: '#010C28', flexShrink: 0 }}>
                Logs Bots <span style={{ fontWeight: '400', color: '#6B7280', fontSize: '12px' }}>({bots.length})</span>
              </h3>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
                {bots.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: '12px' }}>
                    <Bot size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 8px' }} />
                    <p style={{ margin: 0 }}>Aucun log</p>
                  </div>
                ) : bots.map((bot) => (
                  <BotLogCard key={bot.bot_id || bot.id} bot={bot} />
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
