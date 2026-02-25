import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  BarChart,
  BarChart3,
  Bot,
  Calendar,
  Database,
  FileText,
  Filter,
  Info,
  LineChart,
  Mail,
  MailOpen,
  PieChart,
  PieChart as PieIcon,
  RefreshCw,
  TrendingUp,
  User,
  Zap
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api'

// Import de Chart.js
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip
} from 'chart.js'
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const COLORS = {
  primary: '#003087',
  primaryLight: 'rgba(0, 48, 135, 0.1)',
  primaryMedium: 'rgba(0, 48, 135, 0.3)',
  success: '#5FCC80',
  successLight: 'rgba(95, 204, 128, 0.1)',
  successMedium: 'rgba(95, 204, 128, 0.3)',
  warning: '#E3920C',
  warningLight: 'rgba(227, 146, 12, 0.1)',
  warningMedium: 'rgba(227, 146, 12, 0.3)',
  danger: '#D81717',
  dangerLight: 'rgba(216, 23, 23, 0.1)',
  dangerMedium: 'rgba(216, 23, 23, 0.3)',
  info: '#1746D9',
  infoLight: 'rgba(23, 70, 217, 0.1)',
  infoMedium: 'rgba(23, 70, 217, 0.3)',
  gray: '#6B7280',
  grayLight: 'rgba(107, 114, 128, 0.1)',
  background: '#F8FAFF',
  card: 'white'
}

const CHART_CONFIGS = {
  column: {
    label: 'Colonnes',
    icon: BarChart,
    description: 'Idéal pour comparer les volumes d\'emails entre différentes périodes',
    bestFor: 'Comparaisons par jour/semaine'
  },
  bar: {
    label: 'Barres horizontales',
    icon: BarChart3,
    description: 'Parfait pour afficher les expéditeurs ou sujets avec de longs noms',
    bestFor: 'Classements par expéditeur'
  },
  line: {
    label: 'Lignes',
    icon: LineChart,
    description: 'Montre les tendances et évolutions dans le temps',
    bestFor: 'Suivi des tendances temporelles'
  },
  area: {
    label: 'Aires',
    icon: TrendingUp,
    description: 'Visualise l\'accumulation et le volume total d\'emails',
    bestFor: 'Volumes cumulés'
  },
  pie: {
    label: 'Camembert',
    icon: PieIcon,
    description: 'Montre la répartition proportionnelle entre différentes catégories',
    bestFor: 'Proportions et pourcentages'
  },
  donut: {
    label: 'Anneau',
    icon: PieChart,
    description: 'Similaire au camembert mais avec un centre vide pour les informations clés',
    bestFor: 'Proportions avec légende centrale'
  }
}

export default function MailStats() {
  const [stats, setStats] = useState({
    totalEmails: 0,
    emailsToday: 0,
    emailsWeek: 0,
    emailsMonth: 0,
    activeBots: 0,
    totalBots: 0,
    topSender: 'Aucun',
    topSubject: 'Aucun'
  })

  const [emails, setEmails] = useState([])
  const [bots, setBots] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeChart, setActiveChart] = useState('column')
  const [timeRange, setTimeRange] = useState('week')
  const [dateFilter, setDateFilter] = useState('all')
  const [chartAnimation, setChartAnimation] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [emailsRes, botsRes] = await Promise.all([
        api.getAllEmails(1, 5000).catch(() => ({ results: [] })),
        api.getBots().catch(() => [])
      ])

      const allEmails = emailsRes?.results || emailsRes?.data || []
      const botsList = Array.isArray(botsRes) ? botsRes : botsRes?.results || botsRes?.data || []
      
      setEmails(allEmails)
      setBots(botsList)

    } catch (err) {
      console.error('Erreur chargement stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [])

  // Animation du changement de graphique
  useEffect(() => {
    setChartAnimation(true)
    const timer = setTimeout(() => setChartAnimation(false), 500)
    return () => clearTimeout(timer)
  }, [activeChart])

  // Filtrage des emails par date - CORRIGÉ
  const filteredEmails = useMemo(() => {
    if (dateFilter === 'all') return emails
    
    const now = new Date()
    now.setHours(0, 0, 0, 0) // Normaliser à minuit
    
    let filterDate = new Date(now)
    
    switch(dateFilter) {
      case 'today':
        // Aujourd'hui : emails du jour actuel
        filterDate = now
        break
      case 'week':
        // 7 derniers jours
        filterDate.setDate(now.getDate() - 7)
        break
      case 'month':
        // 30 derniers jours
        filterDate.setDate(now.getDate() - 30)
        break
      case 'year':
        // 365 derniers jours
        filterDate.setDate(now.getDate() - 365)
        break
      default:
        return emails
    }
    
    return emails.filter(email => {
      const emailDateStr = email?.received_at?.split('T')[0]
      if (!emailDateStr) return false
      
      const emailDate = new Date(emailDateStr)
      emailDate.setHours(0, 0, 0, 0)
      
      return emailDate >= filterDate
    })
  }, [emails, dateFilter])

  // Calcul des statistiques basées sur les emails filtrés - CORRIGÉ
  const computedStats = useMemo(() => {
    if (filteredEmails.length === 0) {
      return {
        totalEmails: 0,
        emailsToday: 0,
        emailsWeek: 0,
        emailsMonth: 0,
        activeBots: bots.filter(b => b?.status === 1 || b?.status === 'active' || b?.is_active === true).length,
        totalBots: bots.length,
        topSender: 'Aucun',
        topSubject: 'Aucun'
      }
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    const today = now.toISOString().split('T')[0]
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const getEmailDate = (email) => {
      if (email?.received_at) {
        const match = email.received_at.match(/^(\d{4}-\d{2}-\d{2})/)
        if (match) return match[1]
      }
      return null
    }

    // Compter les emails selon différentes périodes
    let emailsToday = 0
    let emailsWeek = 0
    let emailsMonth = 0

    filteredEmails.forEach(email => {
      const dateStr = getEmailDate(email)
      if (!dateStr) return
      
      const emailDate = new Date(dateStr)
      
      if (dateStr === today) emailsToday++
      if (emailDate >= weekAgo) emailsWeek++
      if (emailDate >= monthAgo) emailsMonth++
    })

    // Statistiques des expéditeurs et sujets
    const senderCounts = {}
    const subjectCounts = {}

    filteredEmails.forEach(email => {
      // Compter les expéditeurs
      const sender = email.sender || email.from || 'Inconnu'
      senderCounts[sender] = (senderCounts[sender] || 0) + 1

      // Compter les sujets
      const subject = email.subject || 'Sans sujet'
      if (subject !== 'Sans sujet') {
        subjectCounts[subject] = (subjectCounts[subject] || 0) + 1
      }
    })

    const topSenderEntry = Object.entries(senderCounts)
      .sort((a, b) => b[1] - a[1])[0]
    
    const topSubjectEntry = Object.entries(subjectCounts)
      .sort((a, b) => b[1] - a[1])[0]

    const activeBots = bots.filter(b => 
      b?.status === 1 || b?.status === 'active' || b?.is_active === true
    ).length

    return {
      totalEmails: filteredEmails.length,
      emailsToday,
      emailsWeek,
      emailsMonth,
      activeBots,
      totalBots: bots.length,
      topSender: topSenderEntry ? `${topSenderEntry[0].substring(0, 20)}${topSenderEntry[0].length > 20 ? '...' : ''} (${topSenderEntry[1]})` : 'Aucun',
      topSubject: topSubjectEntry ? `${topSubjectEntry[0].substring(0, 30)}${topSubjectEntry[0].length > 30 ? '...' : ''} (${topSubjectEntry[1]})` : 'Aucun'
    }
  }, [filteredEmails, bots])

  // Mettre à jour les stats affichées
  useEffect(() => {
    setStats(computedStats)
  }, [computedStats])

  // Données pour les graphiques
  const chartData = useMemo(() => {
    if (filteredEmails.length === 0) {
      return {
        labels: ['Aucune donnée'],
        datasets: [{
          label: 'Emails',
          data: [0],
          backgroundColor: COLORS.primaryLight,
          borderColor: COLORS.primary,
          borderWidth: 1
        }]
      }
    }

    // Grouper par date selon la période
    const grouped = {}
    
    // Déterminer la plage de dates à afficher
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    let startDate = new Date(now)
    switch(dateFilter) {
      case 'today':
        startDate = now
        break
      case 'week':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate.setDate(now.getDate() - 30)
        break
      case 'year':
        startDate.setDate(now.getDate() - 365)
        break
      default:
        // Pour 'all', prendre le plus ancien email
        const oldestEmail = filteredEmails.reduce((oldest, email) => {
          const date = email?.received_at?.split('T')[0]
          return date && (!oldest || date < oldest) ? date : oldest
        }, null)
        if (oldestEmail) {
          startDate = new Date(oldestEmail)
        } else {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 jours par défaut
        }
    }
    
    filteredEmails.forEach(email => {
      const dateStr = email?.received_at?.split('T')[0]
      if (!dateStr) return
      
      const date = new Date(dateStr)
      if (date < startDate) return // Ignorer les emails avant la date de début
      
      let key
      
      // Adapter le regroupement en fonction de l'étendue des données
      const dateDiff = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24))
      
      if (dateDiff <= 2) {
        // Moins de 2 jours : regroupement par heure
        key = date.toLocaleDateString('fr-FR', { 
          day: 'numeric', 
          month: 'short',
          hour: '2-digit'
        }) + 'h'
      } else if (dateDiff <= 31) {
        // Moins d'un mois : regroupement par jour
        key = date.toLocaleDateString('fr-FR', { 
          day: 'numeric', 
          month: 'short' 
        })
      } else if (dateDiff <= 92) {
        // Moins de 3 mois : regroupement par semaine
        const weekNumber = Math.ceil((date - startDate) / (7 * 24 * 60 * 60 * 1000))
        key = `Semaine ${weekNumber + 1}`
      } else {
        // Plus de 3 mois : regroupement par mois
        key = date.toLocaleDateString('fr-FR', { 
          month: 'short', 
          year: '2-digit' 
        })
      }
      
      grouped[key] = (grouped[key] || 0) + 1
    })

    // Obtenir les clés triées
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      // Essayer de convertir en dates pour un tri chronologique
      const dateA = new Date(a)
      const dateB = new Date(b)
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return dateA - dateB
      }
      return a.localeCompare(b)
    })

    const labels = sortedKeys
    const data = sortedKeys.map(key => grouped[key])

    // Préparer les couleurs selon le type de graphique
    let backgroundColor
    if (activeChart === 'pie' || activeChart === 'donut') {
      backgroundColor = [
        COLORS.primary,
        COLORS.success,
        COLORS.info,
        COLORS.warning,
        COLORS.danger,
        '#8B5CF6',
        '#10B981',
        '#F59E0B',
        '#EF4444',
        '#6B7280'
      ].slice(0, Math.min(labels.length, 10))
    } else {
      backgroundColor = activeChart === 'column' || activeChart === 'bar' 
        ? COLORS.primaryMedium
        : 'transparent'
    }

    return {
      labels,
      datasets: [{
        label: 'Emails reçus',
        data,
        borderColor: COLORS.primary,
        backgroundColor,
        borderWidth: 3,
        fill: activeChart === 'area',
        tension: 0.4,
        borderRadius: activeChart === 'column' ? 6 : 0,
        animation: chartAnimation ? {
          duration: 1000,
          easing: 'easeOutQuart'
        } : false
      }]
    }
  }, [filteredEmails, activeChart, dateFilter, chartAnimation])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top', 
        labels: { 
          font: { size: 14, weight: '600' }, 
          color: '#010C28',
          padding: 20,
          usePointStyle: true
        } 
      },
      tooltip: { 
        backgroundColor: 'rgba(1, 12, 40, 0.95)', 
        titleFont: { size: 14 }, 
        bodyFont: { size: 13 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || ''
            if (label) label += ': '
            if (context.parsed.y !== null) {
              label += context.parsed.y + ' email' + (context.parsed.y !== 1 ? 's' : '')
            }
            return label
          }
        }
      }
    },
    scales: activeChart !== 'pie' && activeChart !== 'donut' ? {
      x: { 
        grid: { 
          display: activeChart !== 'area',
          color: 'rgba(229, 235, 249, 0.3)'
        },
        ticks: { 
          color: '#242D45',
          font: { size: 11 },
          maxRotation: 45
        } 
      },
      y: { 
        beginAtZero: true,
        grid: { 
          color: 'rgba(229, 235, 249, 0.3)'
        },
        ticks: { 
          color: '#242D45',
          font: { size: 12 },
          precision: 0,
          callback: function(value) {
            return value
          }
        } 
      }
    } : {},
    animation: chartAnimation ? {
      duration: 1000,
      easing: 'easeOutQuart'
    } : {}
  }), [activeChart, chartAnimation])

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
      style={{
        background: COLORS.card,
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        border: `1px solid ${COLORS.primaryLight}`,
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flex: 1,
        minWidth: '250px'
      }}
    >
      <motion.div
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 0.5, delay: 1 }}
        style={{
          background: color + '20',
          padding: '16px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Icon size={28} color={color} />
      </motion.div>
      <div style={{ flex: 1 }}>
        <p style={{ 
          margin: 0, 
          fontSize: '14px', 
          color: '#6B7280',
          fontWeight: '500',
          marginBottom: '8px'
        }}>
          {title}
        </p>
        <motion.p 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ 
            margin: 0, 
            fontSize: '32px', 
            fontWeight: '700',
            color: '#010C28'
          }}
        >
          {value}
        </motion.p>
        {subtitle && (
          <p style={{ 
            margin: '4px 0 0', 
            fontSize: '13px', 
            color: '#6B7280'
          }}>
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  )

  const QuickStat = ({ icon: Icon, label, value, color }) => (
    <motion.div
      whileHover={{ scale: 1.05 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring" }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: COLORS.background,
        borderRadius: '12px',
        border: `1px solid ${COLORS.primaryLight}`
      }}
    >
      <div style={{
        padding: '8px',
        background: color + '20',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>{label}</p>
        <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: '600', color: '#010C28' }}>
          {value}
        </p>
      </div>
    </motion.div>
  )

  const chartComponents = {
    column: <Bar data={chartData} options={chartOptions} />,
    bar: <Bar data={chartData} options={{ ...chartOptions, indexAxis: 'y' }} />,
    area: <Line data={chartData} options={{ ...chartOptions, fill: true }} />,
    line: <Line data={chartData} options={chartOptions} />,
    pie: <Pie data={chartData} options={chartOptions} />,
    donut: <Doughnut data={chartData} options={chartOptions} />
  }

  const ChartExplanation = () => (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'rgba(0, 48, 135, 0.05)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        borderLeft: `4px solid ${COLORS.primary}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}
    >
      <Info size={20} color={COLORS.primary} />
      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: COLORS.primary }}>
          {CHART_CONFIGS[activeChart].label}
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: '#6B7280', lineHeight: '1.5' }}>
          {CHART_CONFIGS[activeChart].description}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#6B7280', fontStyle: 'italic' }}>
          💡 Utilisation recommandée: {CHART_CONFIGS[activeChart].bestFor}
        </p>
      </div>
    </motion.div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: COLORS.background,
        borderRadius: '24px',
        padding: '40px',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '40px'
      }}>
        <div>
          <h2 style={{ 
            margin: 0, 
            fontSize: '32px', 
            fontWeight: '800', 
            color: '#010C28',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <Database size={36} color={COLORS.primary} />
            Statistiques des Emails
          </h2>
          <p style={{ 
            margin: '12px 0 0', 
            fontSize: '16px', 
            color: '#6B7280',
            maxWidth: '600px'
          }}>
            Analyse des données email et performance des bots
          </p>
        </div>

        {/* Bouton d'actualisation */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={loadData}
          disabled={loading}
          style={{
            padding: '12px 24px',
            background: loading ? '#E5EBF9' : '#5FCC80',
            color: loading ? '#6B7280' : 'white',
            border: 'none',
            borderRadius: '12px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
          {loading ? 'Chargement...' : 'Actualiser'}
        </motion.button>
      </div>

      {/* Stats Overview - basé sur les emails filtrés */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          marginBottom: '40px'
        }}
      >
        <StatCard 
          title="Total Emails (période)"
          value={stats.totalEmails.toLocaleString()}
          icon={Mail}
          color={COLORS.primary}
          subtitle="Emails dans la période sélectionnée"
        />
        
        <StatCard 
          title="Emails Aujourd'hui"
          value={stats.emailsToday}
          icon={MailOpen}
          color={COLORS.success}
          subtitle={`${stats.emailsWeek} cette semaine`}
        />
        
        <StatCard 
          title="Emails ce Mois"
          value={stats.emailsMonth}
          icon={Calendar}
          color={COLORS.info}
          subtitle="30 derniers jours"
        />
        
        <StatCard 
          title="Bots Actifs"
          value={`${stats.activeBots}/${stats.totalBots}`}
          icon={Bot}
          color={stats.activeBots > 0 ? COLORS.success : COLORS.danger}
          subtitle="Bots en cours d'exécution"
        />
      </motion.div>

      {/* Filtres de date */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={20} color={COLORS.primary} />
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#010C28' }}>
            Filtre de date:
          </span>
        </div>
        
        <div style={{
          display: 'flex',
          background: COLORS.background,
          padding: '8px',
          borderRadius: '12px',
          border: `1px solid ${COLORS.primaryLight}`
        }}>
          {[
            { key: 'all', label: 'Toutes les dates' },
            { key: 'today', label: 'Aujourd\'hui' },
            { key: 'week', label: '7 derniers jours' },
            { key: 'month', label: '30 derniers jours' },
            { key: 'year', label: 'Cette année' }
          ].map(({ key, label }) => (
            <motion.button
              key={key}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDateFilter(key)}
              style={{
                padding: '8px 16px',
                background: dateFilter === key ? '#E3920C' : 'transparent',
                color: dateFilter === key ? 'white' : '#6B7280',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {label}
            </motion.button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: COLORS.success
            }}
          />
          <span style={{ fontSize: '14px', color: '#6B7280' }}>
            {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''} filtré{filteredEmails.length !== 1 ? 's' : ''}
          </span>
        </div>
      </motion.div>

      {/* Quick Stats - basé sur les emails filtrés */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '40px'
        }}
      >
        <QuickStat 
          icon={User}
          label="Top Expéditeur"
          value={stats.topSender === 'Aucun' ? 'Aucun' : stats.topSender.split(' (')[0]}
          color={COLORS.primary}
        />
        
        <QuickStat 
          icon={FileText}
          label="Sujet Fréquent"
          value={stats.topSubject === 'Aucun' ? 'Aucun' : stats.topSubject.split(' (')[0]}
          color={COLORS.success}
        />
        
        <QuickStat 
          icon={Activity}
          label="Performance Bots"
          value={`${stats.activeBots}/${stats.totalBots}`}
          color={stats.activeBots > 0 ? COLORS.success : COLORS.warning}
        />
        
        <QuickStat 
          icon={TrendingUp}
          label="Tendance"
          value={stats.emailsToday > 0 ? '↑ Active' : '→ Stable'}
          color={stats.emailsToday > 0 ? COLORS.success : COLORS.gray}
        />
      </motion.div>

      {/* Chart Section - basé sur les emails filtrés */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          background: COLORS.card,
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
          border: `1px solid ${COLORS.primaryLight}`,
          marginBottom: '40px'
        }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '24px', 
            fontWeight: '700', 
            color: '#010C28',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <BarChart3 size={28} color={COLORS.primary} />
            Visualisation des données
          </h3>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {/* Chart Type Selector */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              style={{
                display: 'flex',
                background: COLORS.background,
                padding: '8px',
                borderRadius: '12px',
                border: `1px solid ${COLORS.primaryLight}`,
                alignItems: 'center'
              }}
            >
              <span style={{ 
                fontSize: '14px', 
                color: '#6B7280', 
                fontWeight: '500',
                padding: '0 12px'
              }}>
                Type de graphique:
              </span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {Object.entries(CHART_CONFIGS).map(([key, config]) => {
                  const Icon = config.icon
                  return (
                    <motion.button
                      key={key}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setChartAnimation(true)
                        setActiveChart(key)
                      }}
                      title={config.description}
                      style={{
                        padding: '10px 14px',
                        background: activeChart === key ? '#1746D9' : 'transparent',
                        color: activeChart === key ? 'white' : '#6B7280',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Icon size={16} />
                      {config.label.split(' ')[0]}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>

            {/* Time Range Selector - Supprimé car on utilise dateFilter maintenant */}
          </div>
        </div>

        {/* Chart Explanation */}
        <ChartExplanation />

        {/* Chart Title */}
        <div style={{ 
          marginBottom: '24px',
          padding: '16px',
          background: COLORS.background,
          borderRadius: '12px',
          border: `1px solid ${COLORS.primaryLight}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h4 style={{ 
              margin: 0, 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#010C28',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Zap size={20} color={COLORS.primary} />
              {dateFilter === 'all' ? 'Toutes les dates' : 
                dateFilter === 'today' ? 'Emails d\'aujourd\'hui' :
                dateFilter === 'week' ? '7 derniers jours' :
                dateFilter === 'month' ? '30 derniers jours' : 'Cette année'}
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: COLORS.success
                }}
              />
              <span style={{ fontSize: '14px', color: '#6B7280' }}>
                {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''} • 
                Mise à jour: {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Chart Container with Animation */}
        <motion.div 
          key={activeChart + dateFilter}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, type: "spring" }}
          style={{ 
            height: '400px', 
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#242D45',
                opacity: 0.7,
                fontSize: '18px'
              }}
            >
              <div style={{ 
                width: '60px', 
                height: '60px', 
                border: '4px solid #E5EBF9', 
                borderTop: `4px solid ${COLORS.primary}`, 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite',
                marginBottom: '20px'
              }} />
              <p>Chargement des données...</p>
            </motion.div>
          ) : filteredEmails.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#242D45',
                opacity: 0.7,
                fontSize: '18px',
                textAlign: 'center',
                padding: '40px'
              }}
            >
              <AlertCircle size={60} color={COLORS.grayLight} style={{ marginBottom: '20px' }} />
              <p style={{ marginBottom: '12px', fontWeight: '600' }}>Aucune donnée disponible pour cette période</p>
              <p style={{ fontSize: '15px', marginTop: '8px', color: '#242D45', opacity: 0.7 }}>
                Aucun email ne correspond aux critères sélectionnés. Essayez de modifier les filtres.
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeChart}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', width: '100%' }}
              >
                {chartComponents[activeChart] || chartComponents.column}
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>

        {/* Chart Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: `1px solid ${COLORS.primaryLight}`,
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                borderRadius: activeChart === 'column' ? '2px' : '50%', 
                background: COLORS.primary 
              }} />
              <span style={{ fontSize: '14px', color: '#6B7280' }}>Emails reçus</span>
            </div>
            {stats.activeBots > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLORS.success }} />
                <span style={{ fontSize: '14px', color: '#6B7280' }}>Bots actifs ({stats.activeBots})</span>
              </div>
            )}
          </div>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            style={{ 
              background: COLORS.background,
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#6B7280',
              border: `1px solid ${COLORS.primaryLight}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: COLORS.primary,
              animation: 'pulse 2s infinite'
            }} />
            Total: {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Data Summary - basé sur les emails filtrés */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px'
        }}
      >
        {/* Summary Card */}
        <motion.div
          whileHover={{ y: -5 }}
          style={{
            background: COLORS.card,
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            border: `1px solid ${COLORS.primaryLight}`
          }}
        >
          <h4 style={{ 
            margin: '0 0 20px 0', 
            fontSize: '18px', 
            fontWeight: '700', 
            color: '#010C28',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Activity size={20} color={COLORS.primary} />
            Résumé des données
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'Emails dans la période', value: stats.totalEmails, color: COLORS.primary, width: 100 },
              { label: 'Activité aujourd\'hui', value: stats.emailsToday, color: COLORS.success, 
                width: Math.min((stats.emailsToday / Math.max(stats.totalEmails, 1)) * 100, 100) },
              { label: 'Bots actifs', value: `${stats.activeBots}/${stats.totalBots}`, color: COLORS.info,
                width: (stats.activeBots / Math.max(stats.totalBots, 1)) * 100 }
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', color: '#6B7280' }}>{item.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: item.color }}>{item.value}</span>
                </div>
                <div style={{ 
                  height: '8px', 
                  background: COLORS.background, 
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.width}%` }}
                    transition={{ duration: 1, delay: index * 0.2, type: "spring" }}
                    style={{ 
                      width: `${item.width}%`, 
                      height: '100%', 
                      background: item.color,
                      borderRadius: '4px'
                    }} 
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Top Senders - basé sur les emails filtrés */}
        <motion.div
          whileHover={{ y: -5 }}
          style={{
            background: COLORS.card,
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            border: `1px solid ${COLORS.primaryLight}`
          }}
        >
          <h4 style={{ 
            margin: '0 0 20px 0', 
            fontSize: '18px', 
            fontWeight: '700', 
            color: '#010C28',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <User size={20} color={COLORS.primary} />
            Expéditeurs principaux
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(() => {
              const senderCounts = {}
              filteredEmails.forEach(email => {
                const sender = email.sender || email.from || 'Inconnu'
                senderCounts[sender] = (senderCounts[sender] || 0) + 1
              })
              
              const topSenders = Object.entries(senderCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
              
              if (topSenders.length === 0) {
                return (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '20px', 
                    color: '#6B7280',
                    fontSize: '14px'
                  }}>
                    Aucun expéditeur trouvé
                  </div>
                )
              }
              
              return topSenders.map(([sender, count], index) => (
                <motion.div
                  key={sender}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    background: index % 2 === 0 ? COLORS.background : 'transparent',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      background: [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.info][index],
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}>
                      {sender.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#010C28' }}>
                      {sender.length > 20 ? sender.substring(0, 20) + '...' : sender}
                    </span>
                  </div>
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                    style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: COLORS.primary,
                      background: COLORS.primaryLight,
                      padding: '4px 12px',
                      borderRadius: '20px'
                    }}
                  >
                    {count}
                  </motion.span>
                </motion.div>
              ))
            })()}
          </div>
        </motion.div>
      </motion.div>

      <style jsx="true">{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </motion.div>
  )
} 