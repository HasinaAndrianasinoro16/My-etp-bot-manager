// src/pages/admin/CreateUserPage.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, Mail, Lock, Building, User, AlertCircle,
  CheckCircle, ArrowLeft, Shield, Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import backgroundImg from '../../assets/background.jpg';

export default function CreateUserPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    departement: '',
    role: 'user'
  });

  const [errors, setErrors] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    departement: ''
  });

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showPassword, setShowPassword] = useState({ password: false, confirm: false });
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    setMessage({ text: '', type: '' });
  }, [activeStep]);

  useEffect(() => {
    if (!user || !isAdmin) {
      navigate('/login');
      return;
    }
    // SUPPRIMÉ : les lignes problématiques qui bloquent le scroll
    // document.body.style.overflow = 'hidden';
    // document.body.style.height = '100vh';
    
    // Retour propre sans nettoyage inutile
    return () => {};
  }, [user, isAdmin, navigate]);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch('http://localhost:8000/departments/', {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });

        if (!res.ok) {
          setDepartments(['Direction', 'Informatique', 'Comptabilité', 'RH']);
          setFetching(false);
          return;
        }

        const data = await res.json();
        const list = data.departments || data.data || data || [];
        const names = list.map(d => typeof d === 'object' ? (d.name || d) : d);
        setDepartments(names);
      } catch (err) {
        console.error('Erreur chargement départements:', err);
        setDepartments(['Direction', 'Informatique', 'Comptabilité', 'RH']);
      } finally {
        setFetching(false);
      }
    };

    if (user?.token) loadDepartments();
  }, [user?.token]);

  const validateStep = (step) => {
    const newErrors = { ...errors };

    if (step === 1) {
      newErrors.first_name = !form.first_name.trim() ? 'Le prénom est requis' : '';
      newErrors.last_name = !form.last_name.trim() ? 'Le nom est requis' : '';
      newErrors.email = !form.email.trim() ? 'L\'email est requis' : 
                       !form.email.includes('@') ? 'Email invalide' : '';
      
      return Object.values(newErrors).every(error => !error);
    }

    if (step === 2) {
      newErrors.password = form.password.length < 6 ? 'Le mot de passe doit contenir au moins 6 caractères' : '';
      newErrors.confirm_password = form.password !== form.confirm_password ? 'Les mots de passe ne correspondent pas' : 
                                  !form.confirm_password ? 'Veuillez confirmer le mot de passe' : '';
      
      return !newErrors.password && !newErrors.confirm_password;
    }

    if (step === 3) {
      newErrors.departement = !form.departement ? 'Veuillez sélectionner un département' : '';
      return !newErrors.departement;
    }

    return false;
  };

  const handleStepChange = (nextStep) => {
    if (nextStep < activeStep) {
      setActiveStep(nextStep);
      return;
    }

    if (validateStep(activeStep)) {
      setErrors({ first_name: '', last_name: '', email: '', password: '', confirm_password: '', departement: '' });
      setActiveStep(nextStep);
    } else {
      const stepErrors = validateStepWithMessages(activeStep);
      const errorMessages = Object.values(stepErrors).filter(msg => msg);
      
      if (errorMessages.length > 0) {
        setMessage({ text: errorMessages[0], type: 'error' });
      }
    }
  };

  const validateStepWithMessages = (step) => {
    const stepErrors = {};
    
    if (step === 1) {
      if (!form.first_name.trim()) stepErrors.first_name = 'Le prénom est requis';
      if (!form.last_name.trim()) stepErrors.last_name = 'Le nom est requis';
      if (!form.email.trim()) {
        stepErrors.email = 'L\'email est requis';
      } else if (!form.email.includes('@')) {
        stepErrors.email = 'Email invalide';
      }
    }
    
    if (step === 2) {
      if (form.password.length < 6) stepErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
      if (!form.confirm_password) {
        stepErrors.confirm_password = 'Veuillez confirmer le mot de passe';
      } else if (form.password !== form.confirm_password) {
        stepErrors.confirm_password = 'Les mots de passe ne correspondent pas';
      }
    }
    
    if (step === 3) {
      if (!form.departement) stepErrors.departement = 'Veuillez sélectionner un département';
    }
    
    return stepErrors;
  };

  const handleFieldChange = (field, value) => {
    setForm({ ...form, [field]: value });
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    
    // Final validation
    const finalErrors = {};
    
    if (!form.first_name.trim()) finalErrors.first_name = 'Le prénom est requis';
    if (!form.last_name.trim()) finalErrors.last_name = 'Le nom est requis';
    if (!form.email.trim()) {
      finalErrors.email = 'L\'email est requis';
    } else if (!form.email.includes('@')) {
      finalErrors.email = 'Email invalide';
    }
    if (form.password.length < 6) finalErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    if (form.password !== form.confirm_password) finalErrors.confirm_password = 'Les mots de passe ne correspondent pas';
    if (!form.departement) finalErrors.departement = 'Veuillez sélectionner un département';
    
    setErrors(finalErrors);
    
    const hasErrors = Object.values(finalErrors).some(error => error);
    if (hasErrors) {
      const errorMessage = Object.values(finalErrors).find(msg => msg);
      setMessage({ text: errorMessage, type: 'error' });
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await fetch('http://localhost:8000/users/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          confirm_password: form.confirm_password,
          role: form.role,
          departement: form.departement.toLowerCase()
        })
      });
      
      const result = await res.json();
      
      if (res.ok && result.success) {
        setMessage({ text: '✅ Utilisateur créé avec succès !', type: 'success' });
        setForm({ first_name: '', last_name: '', email: '', password: '', confirm_password: '', departement: '', role: 'user' });
        setErrors({ first_name: '', last_name: '', email: '', password: '', confirm_password: '', departement: '' });
        setActiveStep(1);
        
        // Reset form after successful creation
        setTimeout(() => {
          setMessage({ text: '', type: '' });
        }, 3000);
      } else {
        setMessage({ text: result.message || '❌ Erreur lors de la création', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: '❌ Erreur de connexion au serveur. Vérifiez votre connexion.', type: 'error' });
      console.error('Erreur création utilisateur:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const getFieldStyle = (fieldName, hasValue) => {
    const hasError = errors[fieldName];
    const isValid = hasValue && !hasError;
    
    return {
      border: `1.5px solid ${hasError ? '#ef4444' : isValid ? '#60a5fa' : 'rgba(148,163,184,0.38)'}`,
      background: hasError ? 'rgba(239,68,68,0.08)' : 
                  isValid ? 'rgba(255,255,255,0.12)' : 
                  'rgba(255,255,255,0.09)',
      boxShadow: hasError ? '0 0 0 5px rgba(239,68,68,0.15)' : 
                 isValid ? '0 0 0 5px rgba(96,165,250,0.28)' : 'none'
    };
  };
  
  const getIconColor = (fieldName, hasValue) => {
    const hasError = errors[fieldName];
    if (hasError) return '#ef4444';
    if (hasValue && !hasError) return '#60a5fa';
    return '#94a3b8';
  };
  
  const getLabelColor = (fieldName, hasValue) => {
    const hasError = errors[fieldName];
    if (hasError) return '#fca5a5';
    if (hasValue && !hasError) return '#60a5fa';
    return '#94a3b8';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: '20px',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.84)', zIndex: 1 }} />
      
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        style={{
          zIndex: 2,
          width: '100%',
          maxWidth: '540px',
          background: 'rgba(30,41,59,0.68)',
          backdropFilter: 'blur(20px)',
          borderRadius: '28px',
          border: '1px solid rgba(148,163,184,0.32)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.65)',
          padding: '64px 48px',
          boxSizing: 'border-box',
          margin: '20px 0',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <Link
            to="/admin/users"
            style={{
              color: '#e5e7eb',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '40px',
              textDecoration: 'none',
              fontSize: '15.5px',
              fontWeight: '500',
            }}
          >
            <ArrowLeft size={20} /> Retour à la liste
          </Link>
          
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            borderRadius: '20px',
            margin: '0 auto 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 15px 50px rgba(102,126,234,0.45)',
          }}>
            <UserPlus size={36} color="white" />
          </div>
          
          <h1 style={{
            fontSize: '2.6rem',
            fontWeight: 900,
            color: '#f1f5f9',
            margin: '0 0 12px',
            letterSpacing: '-1px',
          }}>
            Créer un utilisateur
          </h1>
          
          <p style={{ color: '#e5e7eb', fontSize: '16.5px' }}>
            Ajoutez un nouveau compte en toute sécurité
          </p>
        </div>

        {/* Message d'erreur/succès */}
        <AnimatePresence>
          {message.text && (
            <motion.div
              key={message.type}
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{
                margin: '0 0 40px 0',
                padding: '16px 20px',
                borderRadius: '16px',
                background: message.type === 'success' 
                  ? 'rgba(16, 185, 129, 0.18)' 
                  : 'rgba(239, 68, 68, 0.18)',
                color: message.type === 'success' 
                  ? '#6ee7b7' 
                  : '#fca5a5',
                border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                borderLeft: `5px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
                fontSize: '15px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: message.type === 'success' 
                  ? '0 4px 16px rgba(16,185,129,0.18)' 
                  : '0 4px 16px rgba(239,68,68,0.18)',
              }}
            >
              {message.type === 'success' ? (
                <CheckCircle size={22} strokeWidth={2.5} />
              ) : (
                <AlertCircle size={22} strokeWidth={2.5} />
              )}
              <span>{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Indicateur d'étape */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              style={{
                width: step === activeStep ? '32px' : '12px',
                height: '12px',
                borderRadius: '6px',
                background: step === activeStep 
                  ? 'linear-gradient(90deg, #2563eb, #3b82f6)' 
                  : 'rgba(148,163,184,0.4)',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '36px' }}>
            
            {/* ÉTAPE 1 : Informations personnelles */}
            {activeStep === 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '36px' }}>
                  
                  {/* Prénom */}
                  <div style={{ position: 'relative' }}>
                    <label
                      style={{
                        position: 'absolute',
                        left: '24px',
                        top: form.first_name ? '-14px' : '16px',
                        transform: form.first_name ? 'translateY(0) scale(0.85)' : 'none',
                        background: 'rgba(30,41,59,1)',
                        padding: '0 10px',
                        color: getLabelColor('first_name', form.first_name),
                        fontSize: form.first_name ? '13px' : '15px',
                        pointerEvents: 'none',
                        transition: 'all 0.3s ease',
                        zIndex: 10,
                        borderRadius: '6px',
                      }}
                    >
                      Prénom {errors.first_name && <span style={{color: '#ef4444'}}>*</span>}
                    </label>
                    <User
                      size={20}
                      style={{
                        position: 'absolute',
                        left: '24px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: getIconColor('first_name', form.first_name),
                        pointerEvents: 'none',
                        zIndex: 2,
                        opacity: form.first_name ? 1 : 0.85,
                      }}
                    />
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={e => handleFieldChange('first_name', e.target.value)}
                      placeholder={!form.first_name ? "Prénom" : ""}
                      style={{
                        width: '100%',
                        padding: '28px 24px 18px 60px',
                        fontSize: '16px',
                        border: getFieldStyle('first_name', form.first_name).border,
                        background: getFieldStyle('first_name', form.first_name).background,
                        boxShadow: getFieldStyle('first_name', form.first_name).boxShadow,
                        borderRadius: '14px',
                        color: '#f1f5f9',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.25s ease',
                      }}
                    />
                    {errors.first_name && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: '0',
                        color: '#ef4444',
                        fontSize: '12.5px',
                        paddingLeft: '60px',
                      }}>
                        {errors.first_name}
                      </div>
                    )}
                  </div>
                  
                  {/* Nom */}
                  <div style={{ position: 'relative' }}>
                    <label
                      style={{
                        position: 'absolute',
                        left: '24px',
                        top: form.last_name ? '-14px' : '16px',
                        transform: form.last_name ? 'translateY(0) scale(0.85)' : 'none',
                        background: 'rgba(30,41,59,1)',
                        padding: '0 10px',
                        color: getLabelColor('last_name', form.last_name),
                        fontSize: form.last_name ? '13px' : '15px',
                        pointerEvents: 'none',
                        transition: 'all 0.3s ease',
                        zIndex: 10,
                        borderRadius: '6px',
                      }}
                    >
                      Nom {errors.last_name && <span style={{color: '#ef4444'}}>*</span>}
                    </label>
                    <User
                      size={20}
                      style={{
                        position: 'absolute',
                        left: '24px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: getIconColor('last_name', form.last_name),
                        pointerEvents: 'none',
                        zIndex: 2,
                        opacity: form.last_name ? 1 : 0.85,
                      }}
                    />
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={e => handleFieldChange('last_name', e.target.value)}
                      placeholder={!form.last_name ? "Nom" : ""}
                      style={{
                        width: '100%',
                        padding: '28px 24px 18px 60px',
                        fontSize: '16px',
                        border: getFieldStyle('last_name', form.last_name).border,
                        background: getFieldStyle('last_name', form.last_name).background,
                        boxShadow: getFieldStyle('last_name', form.last_name).boxShadow,
                        borderRadius: '14px',
                        color: '#f1f5f9',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.25s ease',
                      }}
                    />
                    {errors.last_name && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: '0',
                        color: '#ef4444',
                        fontSize: '12.5px',
                        paddingLeft: '60px',
                      }}>
                        {errors.last_name}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Email */}
                <div style={{ position: 'relative' }}>
                  <label
                    style={{
                      position: 'absolute',
                      left: '24px',
                      top: form.email ? '-14px' : '16px',
                      transform: form.email ? 'translateY(0) scale(0.85)' : 'none',
                      background: 'rgba(30,41,59,1)',
                      padding: '0 10px',
                      color: getLabelColor('email', form.email),
                      fontSize: form.email ? '13px' : '15px',
                      pointerEvents: 'none',
                      transition: 'all 0.3s ease',
                      zIndex: 10,
                      borderRadius: '6px',
                    }}
                  >
                    Email professionnel {errors.email && <span style={{color: '#ef4444'}}>*</span>}
                  </label>
                  <Mail
                    size={20}
                    style={{
                      position: 'absolute',
                      left: '24px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: getIconColor('email', form.email),
                      pointerEvents: 'none',
                      zIndex: 2,
                      opacity: form.email ? 1 : 0.85,
                    }}
                  />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => handleFieldChange('email', e.target.value)}
                    placeholder={!form.email ? "Email professionnel" : ""}
                    style={{
                      width: '100%',
                      padding: '28px 24px 18px 60px',
                      fontSize: '16px',
                      border: getFieldStyle('email', form.email).border,
                      background: getFieldStyle('email', form.email).background,
                      boxShadow: getFieldStyle('email', form.email).boxShadow,
                      borderRadius: '14px',
                      color: '#f1f5f9',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.25s ease',
                    }}
                  />
                  {errors.email && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: '0',
                      color: '#ef4444',
                      fontSize: '12.5px',
                      paddingLeft: '60px',
                    }}>
                      {errors.email}
                    </div>
                  )}
                </div>
                
                <motion.button
                  type="button"
                  onClick={() => handleStepChange(2)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    width: '100%',
                    marginTop: '44px',
                    padding: '18px',
                    background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '14px',
                    fontSize: '16.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Continuer → Étape 2
                </motion.button>
              </motion.div>
            )}
            
            {/* ÉTAPE 2 : Mot de passe */}
            {activeStep === 2 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  
                  {/* Mot de passe */}
                  <div style={{ position: 'relative' }}>
                    <label
                      style={{
                        position: 'absolute',
                        left: '24px',
                        top: form.password ? '-14px' : '16px',
                        transform: form.password ? 'translateY(0) scale(0.85)' : 'none',
                        background: 'rgba(30,41,59,1)',
                        padding: '0 10px',
                        color: getLabelColor('password', form.password),
                        fontSize: form.password ? '13px' : '15px',
                        pointerEvents: 'none',
                        transition: 'all 0.3s ease',
                        zIndex: 10,
                        borderRadius: '6px',
                      }}
                    >
                      Mot de passe {errors.password && <span style={{color: '#ef4444'}}>*</span>}
                    </label>
                    <Lock
                      size={20}
                      style={{
                        position: 'absolute',
                        left: '24px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: getIconColor('password', form.password),
                        pointerEvents: 'none',
                        zIndex: 2,
                        opacity: form.password ? 1 : 0.85,
                      }}
                    />
                    <input
                      type={showPassword.password ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => handleFieldChange('password', e.target.value)}
                      placeholder={!form.password ? "Mot de passe (min. 6 caractères)" : ""}
                      style={{
                        width: '100%',
                        padding: '28px 54px 18px 60px',
                        fontSize: '16px',
                        border: getFieldStyle('password', form.password).border,
                        background: getFieldStyle('password', form.password).background,
                        boxShadow: getFieldStyle('password', form.password).boxShadow,
                        borderRadius: '14px',
                        color: '#f1f5f9',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.25s ease',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => ({ ...p, password: !p.password }))}
                      style={{
                        position: 'absolute',
                        right: '24px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#cbd5e1',
                        cursor: 'pointer',
                      }}
                    >
                      {showPassword.password ? <EyeOff size={22} /> : <Eye size={22} />}
                    </button>
                    {errors.password && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: '0',
                        color: '#ef4444',
                        fontSize: '12.5px',
                        paddingLeft: '60px',
                      }}>
                        {errors.password}
                      </div>
                    )}
                  </div>
                  
                  {/* Confirmation */}
                  <div style={{ position: 'relative' }}>
                    <label
                      style={{
                        position: 'absolute',
                        left: '24px',
                        top: form.confirm_password ? '-14px' : '16px',
                        transform: form.confirm_password ? 'translateY(0) scale(0.85)' : 'none',
                        background: 'rgba(30,41,59,1)',
                        padding: '0 10px',
                        color: getLabelColor('confirm_password', form.confirm_password),
                        fontSize: form.confirm_password ? '13px' : '15px',
                        pointerEvents: 'none',
                        transition: 'all 0.3s ease',
                        zIndex: 10,
                        borderRadius: '6px',
                      }}
                    >
                      Confirmation {errors.confirm_password && <span style={{color: '#ef4444'}}>*</span>}
                    </label>
                    <Shield
                      size={20}
                      style={{
                        position: 'absolute',
                        left: '24px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: getIconColor('confirm_password', form.confirm_password),
                        pointerEvents: 'none',
                        zIndex: 2,
                        opacity: form.confirm_password ? 1 : 0.85,
                      }}
                    />
                    <input
                      type={showPassword.confirm ? 'text' : 'password'}
                      value={form.confirm_password}
                      onChange={e => handleFieldChange('confirm_password', e.target.value)}
                      placeholder={!form.confirm_password ? "Confirmez le mot de passe" : ""}
                      style={{
                        width: '100%',
                        padding: '28px 54px 18px 60px',
                        fontSize: '16px',
                        border: getFieldStyle('confirm_password', form.confirm_password).border,
                        background: getFieldStyle('confirm_password', form.confirm_password).background,
                        boxShadow: getFieldStyle('confirm_password', form.confirm_password).boxShadow,
                        borderRadius: '14px',
                        color: '#f1f5f9',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.25s ease',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => ({ ...p, confirm: !p.confirm }))}
                      style={{
                        position: 'absolute',
                        right: '24px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#cbd5e1',
                        cursor: 'pointer',
                      }}
                    >
                      {showPassword.confirm ? <EyeOff size={22} /> : <Eye size={22} />}
                    </button>
                    {errors.confirm_password && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: '0',
                        color: '#ef4444',
                        fontSize: '12.5px',
                        paddingLeft: '60px',
                      }}>
                        {errors.confirm_password}
                      </div>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '18px', marginTop: '44px' }}>
                  <motion.button
                    type="button"
                    onClick={() => handleStepChange(1)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      flex: 1,
                      padding: '18px',
                      background: 'rgba(255,255,255,0.10)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(148,163,184,0.40)',
                      borderRadius: '14px',
                      fontSize: '15.5px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    ← Retour
                  </motion.button>
                  
                  <motion.button
                    type="button"
                    onClick={() => handleStepChange(3)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      flex: 1,
                      padding: '18px',
                      background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '14px',
                      fontSize: '15.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Continuer → Étape 3
                  </motion.button>
                </div>
              </motion.div>
            )}
            
            {/* ÉTAPE 3 : Département et rôle */}
            {activeStep === 3 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                <div style={{ position: 'relative', marginBottom: '36px' }}>
                  <label
                    style={{
                      position: 'absolute',
                      left: '24px',
                      top: form.departement ? '-14px' : '16px',
                      transform: form.departement ? 'translateY(0) scale(0.85)' : 'none',
                      background: 'rgba(30,41,59,1)',
                      padding: '0 10px',
                      color: getLabelColor('departement', form.departement),
                      fontSize: form.departement ? '13px' : '15px',
                      pointerEvents: 'none',
                      transition: 'all 0.3s ease',
                      zIndex: 10,
                      borderRadius: '6px',
                    }}
                  >
                    Département {errors.departement && <span style={{color: '#ef4444'}}>*</span>}
                  </label>
                  <Building
                    size={20}
                    style={{
                      position: 'absolute',
                      left: '24px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: getIconColor('departement', form.departement),
                      pointerEvents: 'none',
                      zIndex: 2,
                      opacity: form.departement ? 1 : 0.8,
                    }}
                  />
                  <select
                    value={form.departement}
                    disabled={fetching}
                    onChange={e => handleFieldChange('departement', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '28px 56px 18px 60px',
                      fontSize: '16px',
                      background: 'rgba(55,65,81,0.95)',
                      color: '#f1f5f9',
                      border: getFieldStyle('departement', form.departement).border,
                      boxShadow: getFieldStyle('departement', form.departement).boxShadow,
                      borderRadius: '14px',
                      outline: 'none',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23e5e7eb' viewBox='0 0 20 20'%3E%3Cpath d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 24px center',
                      backgroundSize: '20px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="" style={{ color: '#94a3b8', background: '#1f2937' }}>
                      {fetching ? 'Chargement...' : 'Sélectionner département'}
                    </option>
                    {departments.map((d, i) => (
                      <option
                        key={i}
                        value={d.toLowerCase()}
                        style={{ color: '#f1f5f9', background: '#1f2937' }}
                      >
                        {d}
                      </option>
                    ))}
                  </select>
                  {errors.departement && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: '0',
                      color: '#ef4444',
                      fontSize: '12.5px',
                      paddingLeft: '60px',
                    }}>
                      {errors.departement}
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '36px' }}>
                  {[
                    { value: 'user', label: 'Utilisateur standard', desc: 'Accès limité' },
                    { value: 'admin', label: 'Administrateur', desc: 'Accès complet' },
                  ].map((role) => (
                    <label
                      key={role.value}
                      style={{
                        padding: '18px 20px',
                        border: `1.5px solid ${form.role === role.value ? '#60a5fa' : 'rgba(148,163,184,0.40)'}`,
                        borderRadius: '14px',
                        background: form.role === role.value ? 'rgba(96,165,250,0.20)' : 'rgba(255,255,255,0.08)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role.value}
                        checked={form.role === role.value}
                        onChange={e => setForm({ ...form, role: e.target.value })}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: '600', color: form.role === role.value ? '#60a5fa' : '#f1f5f9' }}>
                          {role.label}
                        </div>
                        <div style={{ fontSize: '13.5px', color: '#cbd5e1' }}>{role.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                
                <div style={{ display: 'flex', gap: '18px' }}>
                  <motion.button
                    type="button"
                    onClick={() => handleStepChange(2)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      flex: 1,
                      padding: '18px',
                      background: 'rgba(255,255,255,0.10)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(148,163,184,0.40)',
                      borderRadius: '14px',
                      fontSize: '15.5px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    ← Retour
                  </motion.button>
                  
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.03 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    style={{
                      flex: 1,
                      padding: '18px',
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '14px',
                      fontSize: '15.5px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.75 : 1,
                    }}
                  >
                    {loading ? 'Création en cours...' : 'Créer l\'utilisateur ✅'}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </div>
        </form>
        
        <div style={{ marginTop: '48px', fontSize: '14.5px', color: '#94a3b8', textAlign: 'center' }}>
          Tous les champs sont obligatoires • Sécurité renforcée
        </div>
      </motion.div>
    </div>
  );
}