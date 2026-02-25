// src/components/Layout/Header.jsx
import { useAuth } from '../../context/AuthContext'
import { User, Shield } from 'lucide-react'

export default function Header() {
  const { user } = useAuth()

  return (
    <header style={{
      height: '70px',
      background: 'white',
      borderBottom: '1px solid #eee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 30px',
      position: 'fixed',
      top: 0,
      left: '260px',
      right: 0,
      zIndex: 100
    }}>
      <h1 style={{ margin: 0, fontSize: '24px', color: '#1a1a2e' }}>
        Tableau de bord
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {user?.role === 'admin' && <Shield size={20} color="#28a745" />}
        <User size={20} />
        <span>{user?.email}</span>
      </div>
    </header>
  )
}