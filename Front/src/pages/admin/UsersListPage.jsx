import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, Edit, Users, RefreshCw, X, Building, 
  Mail, Shield, Search, Filter, AlertCircle, Key,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { api } from '../../services/api';

const tableRowVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.04,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1]
    }
  })
};

export default function UsersListPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeFilters, setActiveFilters] = useState({ role: false, search: false });

  const [formData, setFormData] = useState({
    role: '',
    departement: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const loadUsers = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await api.getAllUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const res = await fetch('http://localhost:8000/departments/', {
          headers: { Authorization: `Bearer ${user.token}` }
        });

        if (!res.ok) throw new Error();

        const data = await res.json();
        let list = Array.isArray(data) ? data : data.departments || data.data || [];

        const names = list
          .map(d => (typeof d === 'string' ? d : d.name || d.nom || ''))
          .filter(Boolean)
          .map(d => d.trim());

        setDepartments(names.length > 0 ? names : ['Informatique', 'RH', 'Comptabilité', 'Direction']);
      } catch {
        setDepartments(['Informatique', 'RH', 'Comptabilité', 'Direction']);
      }
    };

    loadDepartments();
  }, []);

  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(u =>
        `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term)
      );
    }

    if (roleFilter !== 'all') {
      result = result.filter(u => (u.role || 'user') === roleFilter);
    }

    return result;
  }, [users, searchTerm, roleFilter]);

  const handleDelete = async (uid_number, fullName) => {
    if (!window.confirm(`Supprimer définitivement ${fullName} ?`)) return;
    try {
      await api.deleteUser(uid_number);
      setUsers(prev => prev.filter(u => u.uid_number !== uid_number));
      setMessage('Utilisateur supprimé avec succès');
      setTimeout(() => setMessage(''), 4000);
    } catch {
      setMessage('Erreur lors de la suppression');
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      role: user.role || 'user',
      departement: user.departement ? user.departement.toLowerCase() : '',
      email: user.email || '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
  };

  const saveChanges = async () => {
    try {
      const payload = { role: formData.role };

      if (formData.email.trim() && formData.email.trim() !== editingUser.email) {
        payload.email = formData.email.trim().toLowerCase();
      }

      if (formData.departement && formData.departement !== editingUser.departement?.toLowerCase()) {
        payload.departement = formData.departement.toLowerCase();
      }

      if (formData.new_password.trim()) {
        if (!formData.current_password.trim()) {
          setMessage('Mot de passe actuel requis pour le changement');
          return;
        }
        if (formData.new_password !== formData.confirm_password) {
          setMessage('Les mots de passe ne correspondent pas');
          return;
        }
        if (formData.new_password.length < 8) {
          setMessage('Le nouveau mot de passe doit faire au moins 8 caractères');
          return;
        }

        payload.current_password = formData.current_password.trim();
        payload.new_password = formData.new_password.trim();
      }

      await api.updateUserAdmin(editingUser.uid_number, payload);

      setUsers(prev =>
        prev.map(u =>
          u.uid_number === editingUser.uid_number ? { ...u, ...payload } : u
        )
      );

      setEditingUser(null);
      setMessage('Utilisateur modifié avec succès');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        'Erreur serveur';
      setMessage('Erreur : ' + msg);
      setTimeout(() => setMessage(''), 6000);
    }
  };

  const getRoleColor = (role) => {
    return role === 'admin' ? '#003087' : '#1746D9';
  };

  const getRoleBg = (role) => {
    return role === 'admin' ? 'rgba(0, 48, 135, 0.1)' : 'rgba(23, 70, 217, 0.1)';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #E5EBF9 0%, #f1f5f9 100%)',
        padding: '40px 32px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: '#010C28'
      }}
    >
      <div style={{ maxWidth: '1480px', margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            marginBottom: '40px',
            padding: '32px 40px',
            background: 'white',
            borderRadius: '24px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(229, 235, 249, 0.8)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '32px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '12px' }}>
                  <div style={{
                    background: '#003087',
                    padding: '16px',
                    borderRadius: '18px',
                    boxShadow: '0 8px 30px rgba(0, 48, 135, 0.2)'
                  }}>
                    <Users size={32} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <h1
                      style={{
                        fontSize: '38px',
                        fontWeight: '900',
                        color: '#010C28',
                        margin: '0 0 6px 0',
                        letterSpacing: '-0.5px',
                      }}
                    >
                      Gestion des utilisateurs
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <p style={{ color: '#242D45', fontSize: '16px', margin: 0, fontWeight: '500' }}>
                        <span style={{ fontWeight: '700', color: '#003087' }}>{filteredUsers.length}</span> utilisateur{filteredUsers.length !== 1 ? 's' : ''} trouvé{filteredUsers.length !== 1 ? 's' : ''}
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{
                          padding: '6px 12px',
                          background: 'rgba(0, 48, 135, 0.1)',
                          color: '#003087',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {users.filter(u => u.role === 'admin').length} Admin
                        </span>
                        <span style={{
                          padding: '6px 12px',
                          background: 'rgba(23, 70, 217, 0.1)',
                          color: '#1746D9',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {users.filter(u => u.role === 'user').length} Utilisateurs
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Rechercher nom ou email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      padding: '15px 20px 15px 52px',
                      width: '280px',
                      border: '2px solid #E5EBF9',
                      borderRadius: '16px',
                      fontSize: '15px',
                      background: 'white',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                    }}
                  />
                  <Search
                    size={20}
                    style={{
                      position: 'absolute',
                      left: '20px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#003087',
                    }}
                  />
                </div>

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  style={{
                    padding: '15px 20px',
                    border: '2px solid #E5EBF9',
                    borderRadius: '16px',
                    fontSize: '15px',
                    background: 'white',
                    minWidth: '180px',
                    color: '#242D45',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  }}
                >
                  <option value="all">Tous les rôles</option>
                  <option value="user">Utilisateurs</option>
                  <option value="admin">Administrateurs</option>
                </select>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={loadUsers}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '15px 28px',
                    background: '#003087',
                    color: 'white',
                    border: 'none',
                    borderRadius: '16px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 8px 30px rgba(0, 48, 135, 0.2)',
                  }}
                >
                  <RefreshCw size={18} />
                  Rafraîchir
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Message Toast */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                padding: '18px 24px',
                marginBottom: '32px',
                background: message.includes('succès') 
                  ? 'rgba(95, 204, 128, 0.15)' 
                  : 'rgba(216, 23, 23, 0.15)',
                color: message.includes('succès') ? '#5FCC80' : '#D81717',
                borderRadius: '14px',
                fontWeight: '600',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              {message.includes('succès') ? 
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '50%',
                  background: '#5FCC80',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{ 
                    width: '8px', 
                    height: '5px', 
                    borderLeft: '2px solid white',
                    borderBottom: '2px solid white',
                    transform: 'rotate(-45deg) translateY(-1px)'
                  }} />
                </div> :
                <AlertCircle size={20} />
              }
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table Container */}
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: 'center',
              padding: '100px 0',
              background: 'white',
              borderRadius: '24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
              border: '1px solid rgba(229, 235, 249, 0.8)',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw size={48} style={{ color: '#003087' }} />
            </motion.div>
            <p style={{ marginTop: '24px', color: '#242D45', fontSize: '16px', fontWeight: '600' }}>
              Chargement des utilisateurs...
            </p>
          </motion.div>
        ) : filteredUsers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              textAlign: 'center',
              padding: '80px 40px',
              background: 'white',
              borderRadius: '24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
              border: '1px solid rgba(229, 235, 249, 0.8)',
            }}
          >
            <Users size={56} style={{ color: '#003087', opacity: 0.5, marginBottom: '24px' }} />
            <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#010C28', marginBottom: '12px' }}>
              Aucun utilisateur trouvé
            </h3>
            <p style={{ fontSize: '16px', color: '#242D45', opacity: 0.7, maxWidth: '400px', margin: '0 auto' }}>
              {searchTerm || roleFilter !== 'all' ? 
                'Ajustez vos critères de recherche' : 
                'Commencez par créer un nouvel utilisateur'
              }
            </p>
            {(searchTerm || roleFilter !== 'all') && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setSearchTerm(''); setRoleFilter('all'); }}
                style={{
                  marginTop: '24px',
                  padding: '10px 24px',
                  background: 'rgba(0, 48, 135, 0.1)',
                  color: '#003087',
                  border: '1px solid rgba(0, 48, 135, 0.2)',
                  borderRadius: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Réinitialiser les filtres
              </motion.button>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'white',
              borderRadius: '24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              border: '1px solid rgba(229, 235, 249, 0.8)',
            }}
          >
            {/* Table Header */}
            <div style={{
              padding: '20px 32px',
              background: 'rgba(0, 48, 135, 0.05)',
              borderBottom: '1px solid rgba(229, 235, 249, 0.8)',
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#010C28' }}>
                Liste des utilisateurs
              </h3>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ 
                    background: 'rgba(229, 235, 249, 0.3)', 
                    borderBottom: '2px solid rgba(229, 235, 249, 0.8)'
                  }}>
                    {['Nom complet', 'Email', 'Rôle', 'Département', 'Actions'].map((header, idx) => (
                      <th key={idx} style={{ 
                        padding: '20px 32px', 
                        textAlign: 'left', 
                        fontWeight: '700', 
                        color: '#242D45', 
                        fontSize: '14px',
                      }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, index) => (
                    <motion.tr
                      key={u.uid_number}
                      custom={index}
                      initial="hidden"
                      animate="visible"
                      variants={tableRowVariants}
                      style={{
                        borderBottom: '1px solid rgba(229, 235, 249, 0.5)',
                        backgroundColor: 'white'
                      }}
                      whileHover={{ 
                        backgroundColor: 'rgba(229, 235, 249, 0.2)',
                      }}
                    >
                      <td style={{ padding: '20px 32px', fontWeight: '700', color: '#010C28' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            background: getRoleBg(u.role),
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: getRoleColor(u.role),
                            fontWeight: 'bold',
                            fontSize: '16px'
                          }}>
                            {u.first_name?.[0]}{u.last_name?.[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: '700' }}>
                              {u.first_name} {u.last_name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#242D45', opacity: 0.7 }}>
                              ID: {u.uid_number}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '20px 32px', color: '#242D45' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Mail size={16} color="#003087" />
                          <div style={{ fontWeight: '600' }}>{u.email}</div>
                        </div>
                      </td>
                      <td style={{ padding: '20px 32px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            background: getRoleBg(u.role),
                            color: getRoleColor(u.role),
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                          }}
                        >
                          {u.role === 'admin' && <Shield size={14} />}
                          {u.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                        </span>
                      </td>
                      <td style={{ padding: '20px 32px', color: '#242D45' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Building size={16} color="#E3920C" />
                          <div>
                            <div style={{ fontWeight: '600' }}>
                              {u.departement ? u.departement.charAt(0).toUpperCase() + u.departement.slice(1) : '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => openEditModal(u)}
                            style={{
                              padding: '10px 16px',
                              background: 'rgba(0, 48, 135, 0.1)',
                              color: '#003087',
                              border: '1px solid rgba(0, 48, 135, 0.2)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Edit size={14} />
                            Modifier
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDelete(u.uid_number, `${u.first_name} ${u.last_name}`)}
                            style={{
                              padding: '10px 16px',
                              background: 'rgba(216, 23, 23, 0.1)',
                              color: '#D81717',
                              border: '1px solid rgba(216, 23, 23, 0.2)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Trash2 size={14} />
                            Supprimer
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer - Simplifié */}
            <div style={{
              padding: '20px 32px',
              background: 'rgba(229, 235, 249, 0.1)',
              borderTop: '1px solid rgba(229, 235, 249, 0.5)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '14px',
              color: '#242D45'
            }}>
              <div>
                <span style={{ fontWeight: '600' }}>
                  {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''} sur {users.length}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Modal d'édition */}
        <AnimatePresence>
          {editingUser && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingUser(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.7)',
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
                padding: '20px',
              }}>
                <motion.div
                  initial={{ scale: 0.96, opacity: 0, y: 30 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.96, opacity: 0, y: 30 }}
                  style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '32px',
                    maxWidth: '500px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxShadow: '0 40px 120px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(229, 235, 249, 0.8)',
                    position: 'relative'
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => setEditingUser(null)}
                    style={{
                      position: 'absolute',
                      top: '20px',
                      right: '20px',
                      background: 'rgba(229, 235, 249, 0.8)',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={20} style={{ color: '#242D45' }} />
                  </button>

                  <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ 
                      margin: 0, 
                      fontSize: '24px', 
                      fontWeight: '700', 
                      color: '#010C28',
                      marginBottom: '4px'
                    }}>
                      Modifier l'utilisateur
                    </h2>
                    <p style={{ color: '#242D45', fontSize: '14px', margin: 0 }}>
                      {editingUser.first_name} {editingUser.last_name}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gap: '20px' }}>
                    {/* Email */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#010C28', fontSize: '14px' }}>
                        Adresse email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #E5EBF9',
                          borderRadius: '12px',
                          fontSize: '14px',
                          background: 'white',
                        }}
                      />
                    </div>

                    {/* Rôle */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#010C28', fontSize: '14px' }}>
                        Rôle utilisateur
                      </label>
                      <select
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #E5EBF9',
                          borderRadius: '12px',
                          fontSize: '14px',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="user">Utilisateur standard</option>
                        <option value="admin">Administrateur système</option>
                      </select>
                    </div>

                    {/* Département */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#010C28', fontSize: '14px' }}>
                        Département
                      </label>
                      <select
                        value={formData.departement}
                        onChange={e => setFormData({ ...formData, departement: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #E5EBF9',
                          borderRadius: '12px',
                          fontSize: '14px',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Sélectionner un département</option>
                        {departments.map(d => (
                          <option key={d} value={d.toLowerCase()}>
                            {d.charAt(0).toUpperCase() + d.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mot de passe */}
                    <div style={{ 
                      padding: '20px',
                      background: 'rgba(229, 235, 249, 0.3)',
                      borderRadius: '12px',
                      border: '1px solid #E5EBF9'
                    }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#010C28', marginBottom: '16px' }}>
                        Changer le mot de passe (facultatif)
                      </h3>

                      <div style={{ display: 'grid', gap: '12px' }}>
                        <input
                          type="password"
                          placeholder="Mot de passe actuel"
                          value={formData.current_password}
                          onChange={e => setFormData({ ...formData, current_password: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '2px solid #E5EBF9',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />

                        <input
                          type="password"
                          placeholder="Nouveau mot de passe (8 caractères minimum)"
                          value={formData.new_password}
                          onChange={e => setFormData({ ...formData, new_password: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '2px solid #E5EBF9',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />

                        <input
                          type="password"
                          placeholder="Confirmer le nouveau mot de passe"
                          value={formData.confirm_password}
                          onChange={e => setFormData({ ...formData, confirm_password: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '2px solid #E5EBF9',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                      </div>
                    </div>

                    {/* Boutons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setEditingUser(null)}
                        style={{
                          padding: '12px 24px',
                          background: 'rgba(229, 235, 249, 0.8)',
                          color: '#242D45',
                          border: 'none',
                          borderRadius: '12px',
                          fontWeight: '600',
                          fontSize: '14px',
                          cursor: 'pointer',
                        }}
                      >
                        Annuler
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05, boxShadow: '0 8px 30px rgba(0, 48, 135, 0.3)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={saveChanges}
                        style={{
                          padding: '12px 24px',
                          background: '#003087',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          fontWeight: '600',
                          fontSize: '14px',
                          cursor: 'pointer',
                          boxShadow: '0 8px 25px rgba(0, 48, 135, 0.2)'
                        }}
                      >
                        Enregistrer
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}