// src/components/Auth/ProtectedRoute.jsx
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, adminOnly }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f8f9fa'
      }}>
        <Loader2 size={40} className="animate-spin" style={{ color: '#667eea' }} />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (adminOnly && !isAdmin) return <Navigate to="/user" replace />;

  return children;
}