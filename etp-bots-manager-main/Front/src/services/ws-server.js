// src/services/ws-server.js → 100 % MANUEL (aucune notif automatique)
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8001 })

console.log('')
console.log('WebSocket notifications actif → ws://localhost:8001/ws/notifications/')
console.log('Aucune notification automatique.')
console.log('Pour envoyer une notif, tape dans la console du navigateur : sendNotif({ ... })')
console.log('')

// On ne fait RIEN automatiquement
wss.on('connection', (ws) => {
  console.log('Client React connecté (prêt à recevoir tes notifs)')

  ws.on('message', (data) => {
    try {
      const notif = JSON.parse(data)
      console.log('Notif reçue et diffusée →', notif.title)

      // On renvoie à TOUS les clients connectés (y compris toi)
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(notif))
        }
      })
    } catch (e) {
      console.log('Message reçu mais pas du JSON')
    }
  })
})