  // src/pages/LoginPage.jsx
  

  // eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Lock, LogIn, Mail } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

import backgroundImg from '../assets/background.jpg'; // fond an le droite
import chatbotLogo from '../assets/chatbot.JPG';

  // Fonction clamp pour responsivité
  const clamp = (min, preferred, max) => Math.min(Math.max(min, preferred), max);

  export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();

    const handleSubmit = async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      if (!email.trim() || !password.trim()) {
        setError('Veuillez remplir tous les champs');
        setLoading(false);
        return;
      }

      try {
        await login(email.trim(), password.trim());
      // eslint-disable-next-line no-unused-vars
      } catch (err) {
        setError('Identifiants incorrects ou erreur serveur');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'row',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontFamily: 'Inter, system-ui, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* ================== GAUCHE - Formulaire ================== */}
        <div
          style={{
            flex: 0.95,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(145deg, #0f172a 0%, #13294b 50%, #1e293b 100%)',
            padding: `${clamp(30, 5, 70)}px ${clamp(20, 4, 50)}px`,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 40% 60%, rgba(96,165,250,0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <motion.div
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              width: '100%',
              maxWidth: 'clamp(360px, 88%, 440px)',
              zIndex: 2,
            }}
          >
            {/* Logo + titre */}
            <div style={{ textAlign: 'center', marginBottom: `${clamp(40, 8, 64)}px` }}>
              <motion.img
                initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 150, damping: 12, delay: 0.1 }}
                src={chatbotLogo}
                alt="Minibot"
                style={{
                  width: `${clamp(110, 20, 140)}px`,
                  borderRadius: '50%',
                  boxShadow: '0 20px 60px rgba(96,165,250,0.6)',
                  background: 'rgba(255,255,255,0.95)',
                  padding: '12px',
                  border: '3px solid rgba(96,165,250,0.45)',
                }}
              />

              <motion.h1
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.9, delay: 0.4, ease: 'easeOut' }}
                style={{
                  margin: `${clamp(24, 5, 32)}px 0 8px`,
                  fontSize: `${clamp(3.2, 8, 5)}rem`,
                  fontFamily: "'Orbitron', sans-serif", 
                  fontWeight: 900,
                  letterSpacing: '-5px',
                  background: 'linear-gradient(90deg, #60a5fa, #a5b4fc, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 6px 30px rgba(96,165,250,0.5)',
                }}
              >
                MINIBOT
              </motion.h1>

              <motion.p
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                style={{ color: '#94a3b8', fontSize: `${clamp(1.1, 3.5, 1.3)}rem`, marginBottom: '4px' }}
              >
                Votre centre de commande pour bots performants
              </motion.p>

              <motion.p
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7 }}
                style={{ color: '#cbd5e1', fontSize: `${clamp(0.95, 3, 1.1)}rem` }}
              >
                en toute simplicité et contrôle total
              </motion.p>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit}>
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.8 }}
                style={{ marginBottom: `${clamp(28, 5, 36)}px` }}
              >
                <div style={{ position: 'relative' }}>
                  <Mail size={clamp(26, 4, 30)} style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#60a5fa' }} />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: `${clamp(18, 3, 22)}px ${clamp(18, 3, 26)}px ${clamp(18, 3, 22)}px ${clamp(60, 10, 78)}px`,
                      fontSize: `${clamp(1.05, 3.5, 1.18)}rem`,
                      background: 'rgba(255,255,255,0.1)',
                      border: '2px solid rgba(255,255,255,0.18)',
                      borderRadius: '16px',
                      color: 'white',
                      outline: 'none',
                      transition: 'all 0.35s ease',
                      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#60a5fa';
                      e.target.style.boxShadow = '0 0 0 8px rgba(96,165,250,0.35), inset 0 2px 8px rgba(0,0,0,0.3)';
                    }}
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.9 }}
                style={{ marginBottom: `${clamp(32, 6, 44)}px` }}
              >
                <div style={{ position: 'relative' }}>
                  <Lock size={clamp(26, 4, 30)} style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#60a5fa' }} />
                  <input
                    type="password"
                    placeholder="Mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: `${clamp(18, 3, 22)}px ${clamp(18, 3, 26)}px ${clamp(18, 3, 22)}px ${clamp(60, 10, 78)}px`,
                      fontSize: `${clamp(1.05, 3.5, 1.18)}rem`,
                      background: 'rgba(255,255,255,0.1)',
                      border: '2px solid rgba(255,255,255,0.18)',
                      borderRadius: '16px',
                      color: 'white',
                      outline: 'none',
                      transition: 'all 0.35s ease',
                      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#60a5fa';
                      e.target.style.boxShadow = '0 0 0 8px rgba(96,165,250,0.35), inset 0 2px 8px rgba(0,0,0,0.3)';
                    }}
                  />
                </div>
              </motion.div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    color: '#ff8a80',
                    textAlign: 'center',
                    marginBottom: `${clamp(24, 4, 32)}px`,
                    fontSize: `${clamp(1, 3.2, 1.12)}rem`,
                    fontWeight: '500',
                  }}
                >
                  {error}
                </motion.p>
              )}

              <motion.button
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, delay: 1.1 }}
                whileHover={{ scale: loading ? 1 : 1.04, boxShadow: '0 20px 60px rgba(96,165,250,0.5)' }}
                whileTap={{ scale: loading ? 1 : 0.96 }}
                disabled={loading}
                type="submit"
                style={{
                  width: '100%',
                  padding: `${clamp(18, 4, 24)}px`,
                  background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: `${clamp(1.15, 3.5, 1.3)}rem`,
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  boxShadow: '0 14px 40px rgba(37,99,235,0.45)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.75 : 1,
                  transition: 'all 0.3s ease',
                }}
              >
                <LogIn size={clamp(24, 4, 28)} />
                {loading ? 'Connexion...' : 'Se connecter'}
              </motion.button>
            </form>

            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 1.3 }}
              style={{
                marginTop: `${clamp(40, 7, 60)}px`,
                textAlign: 'center',
                fontSize: `${clamp(0.9, 2.8, 0.98)}rem`,
                color: '#94a3b8',
                opacity: 0.9,
              }}
            >
              © 2026 Minibot. Tous droits réservés.
            </motion.div>
          </motion.div>
        </div>

        {/* ================== DROITE - background.jpg ================== */}
        <div
          style={{
            flex: 1.25,
            backgroundImage: `url(${backgroundImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '-20px 0 60px rgba(0,0,0,0.15)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(15,23,42,0.35) 0%, rgba(30,41,59,0.15) 100%)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 2.2, ease: 'easeOut', delay: 0.3 }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${backgroundImg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        </div>
      </div>
    );
  }