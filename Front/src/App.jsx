// src/App.jsx 
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'

import Settings from './components/settings/Settings'
import DashboardAdmin from './pages/DashboardAdmin'
import DashboardUser from './pages/DashboardUser'
import LoginPage from './pages/LoginPage'
import CreateUserPage from './pages/admin/CreateUserPage'
import UsersListPage from './pages/admin/UsersListPage'
import UserProfilePage from './pages/user/UserProfilePage'

import ProtectedRoute from './components/Auth/ProtectedRoute'
import Layout from './components/Layout/Layout'

function App() {
  return (
    <AuthProvider>
      <Routes>

        {/* ====================== PUBLIC ====================== */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<LoginPage />} />

        {/* ====================== USER ====================== */}
        <Route
          path="/user"
          element={
            <ProtectedRoute>
              <Layout>
                <DashboardUser />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/user/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <UserProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ====================== ADMIN ====================== */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <Layout>
                <DashboardAdmin />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/create-user"
          element={
            <ProtectedRoute adminOnly>
              <CreateUserPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute adminOnly>
              <Layout>
                <UsersListPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/Settings"
          element={
            <ProtectedRoute adminOnly>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ====================== 404 ====================== */}
        <Route
          path="*"
          element={
            <div style={{ padding: '100px 50px', textAlign: 'center', fontSize: '32px', fontWeight: 'bold', color: '#666' }}>
              404 - Page non trouvée
            </div>
          }
        />

      </Routes>
    </AuthProvider>
  )
}

export default App