// src/components/Layout/Layout.jsx
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        padding: '24px',
        transition: 'all 0.4s ease',
        marginLeft: 0,
      }}>
        {children}
      </main>
    </div>
  )
}