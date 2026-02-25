import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  ChevronDown,
  Home,
  LogOut,
  Menu,
  Settings,
  X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import chatbotLogo from '../../assets/chatbot.JPG';
import { useAuth } from '../../context/AuthContext';

const SIDEBAR_WIDTH = 90;

const menuItems = [
  { id: 'home', icon: Home, label: 'Accueil', path: '/', roles: ['user', 'admin'] },
  { id: 'bots', icon: Bot, label: 'Bots', path: '/admin', roles: ['admin'] },
  { id: 'settings', icon: Settings, label: 'Paramètres', path: '/Settings', roles: ['admin'] },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [openSub, setOpenSub] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const filteredMenu = useMemo(
    () => (user ? menuItems.filter(i => i.roles.includes(user.role)) : []),
    [user]
  );

  if (!user) return null;

  return (
    <>
      {/* BUTTON OPEN */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            onClick={() => setIsOpen(true)}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 30,
              left: 30,
              width: 56,
              height: 56,
              borderRadius: 16,
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#60a5fa',
              zIndex: 9999,
              cursor: 'pointer',
            }}
          >
            <Menu size={26} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* SIDEBAR */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: -SIDEBAR_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: -SIDEBAR_WIDTH }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              width: SIDEBAR_WIDTH,
              height: '100vh',
              background: 'linear-gradient(180deg,#020617,#020617)',
              borderRight: '1px solid #1e293b',
              position: 'fixed',
              left: 0,
              top: 0,
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* LOGO */}
            <div style={{ padding: '24px 0' }}>
              <img
                src={chatbotLogo}
                alt="Logo"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  objectFit: 'cover',
                  border: '2px solid #3b82f6',
                }}
              />
            </div>

            {/* MENU */}
            <div style={{ flex: 1, width: '100%' }}>
              {filteredMenu.map(item => {
                const isActive = item.path && location.pathname.startsWith(item.path);
                const hasSub = !!item.subItems;
                const isSubOpen = openSub === item.id;

                return (
                  <div key={item.id} style={{ position: 'relative' }}>
                    <motion.button
                      onClick={() =>
                        hasSub
                          ? setOpenSub(isSubOpen ? null : item.id)
                          : navigate(item.path)
                      }
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                      style={{
                        width: '100%',
                        height: 64,
                        background: isActive ? 'rgba(59,130,246,0.2)' : 'transparent',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      <item.icon size={26} color={isActive ? '#60a5fa' : '#94a3b8'} />

                      {/* TOOLTIP */}
                      <div className="sidebar-tooltip">{item.label}</div>

                      {hasSub && (
                        <ChevronDown
                          size={14}
                          style={{
                            position: 'absolute',
                            bottom: 6,
                            color: '#64748b',
                            transform: isSubOpen ? 'rotate(180deg)' : 'none',
                          }}
                        />
                      )}
                    </motion.button>

                    {/* SUB MENU */}
                    {hasSub && isSubOpen && (
                      <div style={{ background: '#020617' }}>
                        {item.subItems.map(sub => (
                          <motion.button
                            key={sub.path}
                            onClick={() => navigate(sub.path)}
                            whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                            style={{
                              width: '100%',
                              height: 48,
                              border: 'none',
                              background: 'transparent',
                              color: '#cbd5f5',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            •
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* LOGOUT */}
            <motion.button
              onClick={logout}
              whileHover={{ scale: 1.05 }}
              style={{
                width: 56,
                height: 56,
                marginBottom: 24,
                borderRadius: 16,
                border: 'none',
                background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              <LogOut size={24} />
            </motion.button>

            {/* CLOSE */}
            <motion.button
              onClick={() => setIsOpen(false)}
              whileHover={{ scale: 1.1 }}
              style={{
                position: 'absolute',
                top: 12,
                right: -18,
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '1px solid #334155',
                background: '#020617',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </motion.button>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* SPACER */}
      <div style={{ width: isOpen ? SIDEBAR_WIDTH : 0 }} />

      {/* TOOLTIP STYLE */}
      <style>{`
        .sidebar-tooltip {
          position: absolute;
          left: 80px;
          background: #020617;
          color: white;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transform: translateX(-10px);
          transition: 0.2s;
          border: 1px solid #1e293b;
        }
        button:hover .sidebar-tooltip {
          opacity: 1;
          transform: translateX(0);
        }
      `}</style>
    </>
  );
}
