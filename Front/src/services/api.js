// src/services/api.js
import axios from 'axios'

const REAL_BASE = 'http://localhost:8000'
const MOCK_BASE = 'https://apibot.free.mockoapp.net'

const realClient = axios.create({
  baseURL: REAL_BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

const longClient = axios.create({
  baseURL: REAL_BASE,
  timeout: 90000,
  headers: { 'Content-Type': 'application/json' },
})

const mockClient = axios.create({
  baseURL: MOCK_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// ====================== GESTION REFRESH TOKEN ======================
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => error ? prom.reject(error) : prom.resolve(token))
  failedQueue = []
}

const setupInterceptors = (client) => {
  client.interceptors.request.use(config => {
    if (config.url?.includes('/user/login/') || config.url?.includes('/token/refresh/')) {
      return config
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user?.token) {
      config.headers.Authorization = `Bearer ${user.token}`
    }
    return config
  })

  client.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config
      if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/login')) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          }).then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return client(originalRequest)
          }).catch(err => Promise.reject(err))
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
          const user = JSON.parse(localStorage.getItem('user') || '{}')
          if (!user?.refresh) throw new Error('Refresh token manquant')

          const refreshResponse = await realClient.post('/user/token/refresh/', { refresh: user.refresh })
          const newToken = refreshResponse.data.access

          user.token = newToken
          localStorage.setItem('user', JSON.stringify(user))
          client.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
          originalRequest.headers.Authorization = `Bearer ${newToken}`

          processQueue(null, newToken)
          return client(originalRequest)
        } catch (refreshError) {
          processQueue(refreshError, null)
          localStorage.removeItem('user')
          window.location.href = '/login'
          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
      }
      return Promise.reject(error)
    }
  )
}

setupInterceptors(realClient)
setupInterceptors(longClient)
setupInterceptors(mockClient)

// ====================== API Rehetra ======================


export const api = {
  login: async (email, password) => {
    const response = await realClient.post('/user/login/', { email, password })
    const data = response.data

    if (data.success && data.access) {
      const rawRole = data.user.role || data.user.roles || ''
      const isAdmin = 
        rawRole === 'admin' ||
        rawRole === 'Admin' ||
        (typeof rawRole === 'string' && rawRole.toLowerCase().includes('admin')) ||
        (Array.isArray(rawRole) && rawRole.some(r => r.toLowerCase().includes('admin')))

      const userData = {
        id: data.user.id,
        uid_number: data.user.uid_number,
        email: data.user.email,
        username: data.user.username,
        first_name: data.user.first_name || '',
        last_name: data.user.last_name || '',
        ldap_dn: data.user.ldap_dn || '',
        role: isAdmin ? 'admin' : 'user',
        token: data.access,
        refresh: data.refresh,
        expires_in: data.expires_in || 900
      }

      localStorage.setItem('user', JSON.stringify(userData))
      return { status: 'success', user: userData }
    }
    throw new Error(data.message || 'Identifiants incorrects')
  },

  logout: async () => {
    try { await realClient.post('/user/logout/') } catch (err) { console.warn('Logout échoué', err) }
    localStorage.removeItem('user')
  },

  getAllUsers: async () => {
    const res = await realClient.get('/users/')
    return res.data.data || res.data.users || res.data || []
  },

  deleteUser: async (uid_number) => {
    console.log('SUPPRESSION → uid_number:', uid_number)
    
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (!user?.token) throw new Error('Pas de token')

    const response = await longClient.delete(`/users/${uid_number}`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      data: {}
    })

    console.log('SUPPRIMÉ AVEC SUCCÈS →', response.data)
    return response
  },

  updateProfile: async (data) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const userId = user.uid_number || user.id
    const token = user.token

    if (!userId || !token) throw new Error('Utilisateur non connecté')

    const payload = {
      email: user.email,
    }

    if (data.email && data.email.trim() && data.email.trim() !== user.email) {
      payload.email = data.email.trim().toLowerCase()
    }

    if (data.new_password?.trim()) {
      payload.current_password = data.current_password.trim()
      payload.new_password = data.new_password.trim()
      payload.confirm_password = data.confirm_password.trim()
    }

    if (Object.keys(payload).length === 1 && payload.email === user.email && !data.new_password) {
      console.log('Aucune modification détectée')
      return { data: { success: true } }
    }

    console.log('REQUÊTE PROFIL → Payload envoyé →', payload)

    const response = await fetch(`http://localhost:8000/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ERREUR BACKEND:', response.status, errorText)
      const err = new Error(`HTTP ${response.status}`)
      err.response = { data: JSON.parse(errorText || '{}') }
      throw err
    }

    const result = await response.json()
    console.log('Profil mis à jour avec succès →', result)
    return result
  },

  updateUserAdmin: async (uid_number, data) => {
    const payload = {}

    if (data.email) payload.email = data.email
    if (data.role) payload.role = data.role
    if (data.departement) payload.departement = data.departement

    if (data.new_password) {
      payload.current_password = data.current_password
      payload.new_password = data.new_password
      payload.confirm_password = data.confirm_password
    }

    console.log('Payload FINAL envoyé au backend →', payload)
    const response = await longClient.put(`/users/${uid_number}`, payload)
    return response
  },

  // BOTS
  getBots: async () => {
    try {
      const res = await realClient.get('/bots/')
      return res.data.results || res.data || []
    } catch (err) {
      console.error('Erreur chargement bots:', err)
      return []
    }
  },

  getBotById: async (botId) => {
    const res = await realClient.get(`/bots/${botId}/`)
    return res.data
  },

  createBot: async (botData) => {
    const res = await realClient.post('/bots/', botData)
    return res.data
  },

  updateBot: async (botId, botData) => {
    const res = await longClient.patch(`/bots/${botId}/`, botData)
    return res.data
  },

  deleteBot: async (botId) => {
    try {
      const res = await realClient.delete(`/bots/${botId}/delete_bot/`)
      return res.data
    } catch (err) {
      throw err
    }
  },

 
  stopBot: async (botId) => {
    try {
      const res = await realClient.post(`/bots/${botId}/stop/`)
      return res.data
    } catch (err) {
      throw err
    }
  },

  pauseBot: async (botId) => {
    try {
      const res = await realClient.post(`/bots/${botId}/pause/`)
      return res.data
    } catch (err) {
      throw err
    }
  },

  startGmailAuth: async () => {
    try {
      const res = await realClient.get('/gmail/start/')
      return res.data
    } catch (err) {
      throw err
    }
  },

  // EMAILS
  getAllEmails: async (page = 1, page_size = 10) => {
    const response = await realClient.get('/mail', {
      params: { page, page_size }
    })
    return response.data
  },

  getEmailById: async (gmail_message_id) => {
    const response = await realClient.get(`/mail/${gmail_message_id}`)
    return response.data
  },

  getUserEmails: async (user_id, page = 1, page_size = 10) => {
    const response = await realClient.get(`/users/${user_id}/mail`, {
      params: { page, page_size }
    })
    return response.data
  },

  getEmails: async (page = 1, limit = 10) => {
    return api.getAllEmails(page, limit)
  },

  // CHAMPS
  getFields: async () => {
    try {
      const res = await realClient.get('/fields/')
      return (res.data.results || []).map(field => ({
        id: field.field_id,
        description: field.description || field.field_name,
        type: field.type || 'string',
        is_indexed: field.is_indexed ?? false,
        need_attachment: field.need_attachment ?? false
      }))
    } catch (err) {
      console.error('Erreur chargement fields:', err)
      return [
        { id: 1, description: 'Avec piece jointe', type: 'boolean', is_indexed: false, need_attachment: true },
        { id: 2, description: 'date d\'envoi', type: 'date', is_indexed: true, need_attachment: false },
        { id: 3, description: 'expediteur', type: 'string', is_indexed: true, need_attachment: false },
        { id: 4, description: 'Sujet', type: 'string', is_indexed: false, need_attachment: false },
        { id: 5, description: 'Nombre de pièce jointes', type: 'number', is_indexed: false, need_attachment: true },
        { id: 6, description: 'Taille total des pièces jointes', type: 'number', is_indexed: false, need_attachment: true },
        { id: 7, description: 'Type fichier pièce jointe', type: 'string', is_indexed: false, need_attachment: true },
        { id: 8, description: 'Nom fichier pièce jointe', type: 'string', is_indexed: false, need_attachment: true }
      ]
    }
  },

  // OPÉRATEURS
  getOperatorsForField: async (fieldId) => {
    if (!fieldId) return []

    try {
      const res = await realClient.get(`/fields/${fieldId}/operators`)
      return (res.data.results || []).map(op => ({
        id: op.operator_id,
        description: op.description || op.label || 'Opérateur inconnu',
        many: op.many ?? false,
        value_type: op.value_type || 'scalar'
      }))
    } catch (err) {
      console.error(`Erreur operators pour field ${fieldId}:`, err)
      const fallback = {
        5: [
          { id: 5, description: 'inferieur à', many: false, value_type: 'scalar' },
          { id: 6, description: 'superieur à', many: false, value_type: 'scalar' }
        ],
        6: [
          { id: 5, description: 'inferieur à', many: false, value_type: 'scalar' },
          { id: 6, description: 'superieur à', many: false, value_type: 'scalar' }
        ],
        7: [
          { id: 8, description: 'Type de tous les pièces jointes', many: false, value_type: 'scalar' },
          { id: 9, description: 'types de piece jointes valides', many: true, value_type: 'scalar' }
        ],
        8: [
          { id: 7, description: 'Nom de pièce jointe contient', many: false, value_type: 'scalar' }
        ]
      }
      return fallback[fieldId] || []
    }
  },

  // Démarre le flux OAuth2 Outlook → retourne { auth_url: "https://login.microsoftonline.com/..." }
startOutlookAuth: async () => {
  const res = await realClient.get('/mail/start/')
  return res.data
},

// Statut connexion Outlook → { connected: bool, email: string, is_valid: bool }
getOutlookStatus: async () => {
  const res = await realClient.get('/mail/status/')
  return res.data
},

// Déconnecte Outlook
disconnectOutlook: async () => {
  const res = await realClient.post('/mail/disconnect/')
  return res.data
},

// ── MODIFIER la fonction activateBot existante ────────────────────────────────
activateBot: async (botId, password) => {
  const res = await realClient.post(`/bots/${botId}/activate/`, { password })
  return res.data
},

getBotEmails: async (botId, page = 1, pageSize = 20) => {
  try {
    const res = await realClient.get('/mail/', {
      params: {
        bot_id: botId,
        page,
        page_size: pageSize
      }
    })
    return res.data
  } catch (err) {
    console.error(`Erreur chargement emails bot ${botId}:`, err)
    return { results: [], count: 0 }
  }
},

}

export default realClient