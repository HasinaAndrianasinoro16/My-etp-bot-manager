// src/pages/user/UserProfilePage.jsx 
import { motion } from 'framer-motion'
import { User, Mail, Shield, Building, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'

export default function UserProfilePage() {
  const { user } = useAuth()

  
  const container = { 
    padding: '30px', 
    maxWidth: '1400px', 
    margin: '0 auto', 
    fontFamily: 'system-ui' 
  }

  const header = {
    textAlign: 'center',
    marginBottom: '40px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    padding: '28px',
    borderRadius: '24px',
    color: 'white',
    boxShadow: '0 15px 35px rgba(99,102,241,0.3)'
  }

  const cardStyle = {
    background: 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(12px)',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  }

  return (
    <div style={container}>
      {/* HEADER – identique à DashboardUser */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 160 }}
        style={header}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: '34px', fontWeight: '800' }}>
          <User size={40} style={{ display: 'inline', marginRight: '14px' }} />
          Mon Profil
        </h1>
        <p style={{ margin: 0, fontSize: '18px', opacity: 0.95 }}>
          Voici vos informations personnelles
        </p>
      </motion.div>

      {/* CARTES D'INFORMATIONS – style glassmorphism cohérent */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '28px', marginBottom: '40px' }}>
        
        {/* Nom d'utilisateur */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={cardStyle}
        >
          <User size={48} style={{ color: '#a78bfa' }} />
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '16px', opacity: 0.8 }}>Nom d'utilisateur</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              {user?.username || 'Non défini'}
            </p>
          </div>
        </motion.div>

        {/* Email */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={cardStyle}
        >
          <Mail size={48} style={{ color: '#60a5fa' }} />
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '16px', opacity: 0.8 }}>Email</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              {user?.email || 'Non défini'}
            </p>
          </div>
        </motion.div>

        {/* Rôle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={cardStyle}
        >
          <Shield size={48} style={{ color: '#34d399' }} />
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '16px', opacity: 0.8 }}>Rôle</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', textTransform: 'capitalize' }}>
              {user?.role || 'user'}
            </p>
          </div>
        </motion.div>

    {/* Département – CORRIGÉ DÉFINITIVEMENT : uniquement "departement" avec "e" */}
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.4 }}
  style={cardStyle}
>
  <Building size={48} style={{ color: '#fbbf24' }} />
  <div>
    <p style={{ margin: '0 0 8px', fontSize: '16px', opacity: 0.8 }}>Département</p>
    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
      {user?.departement 
        ? user.departement.charAt(0).toUpperCase() + user.departement.slice(1)
        : 'Non défini'
      }
    </p>
  </div>
</motion.div>
      </div>

    {/* BOUTON RETOUR – CORRIGÉ DÉFINITIVEMENT */}
<div style={{ textAlign: 'center', marginTop: '40px' }}>
  <Link to="/dashboard">
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{
        background: 'rgba(255,255,255,0.25)',
        backdropFilter: 'blur(12px)',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.2)',
        padding: '16px 36px',
        borderRadius: '50px',
        fontSize: '17px',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        margin: '0 auto',
        boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
        transition: 'all 0.3s ease'
      }}
    >
      <ArrowLeft size={22} />
      Retour au tableau de bord
    </motion.button>
  </Link>
</div>
    </div>
  )
}