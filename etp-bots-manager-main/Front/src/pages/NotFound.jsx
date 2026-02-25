// src/pages/NotFound.jsx 
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ padding: '100px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>404 - Page non trouvée</h1>
      <p><Link to="/">Retour à l'accueil</Link></p>
    </div>
  )
}