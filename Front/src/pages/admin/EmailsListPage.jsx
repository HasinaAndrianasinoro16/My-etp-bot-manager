// src/pages/admin/EmailsListPage.jsx
import EmailsList from '../../components/Monitoring/EmailsList';

export default function EmailsListPage() {
  return (
    <div style={{
      padding: '32px 40px',
      background: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'Inter, sans-serif'
    }}>
      <h1 style={{
        fontSize: '36px',
        fontWeight: '800',
        color: '#111827',
        marginBottom: '8px'
      }}>
        Liste des Emails Reçus
      </h1>
      
      <p style={{
        fontSize: '16px',
        color: '#6b7280',
        marginBottom: '32px'
      }}>
        Tous les emails entrants – cliquez sur "Détails" pour voir le contenu complet
      </p>

      <EmailsList />
    </div>
  );
}