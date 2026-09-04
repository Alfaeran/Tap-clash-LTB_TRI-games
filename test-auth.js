const { io } = require('socket.io-client');
const socket = io('http://localhost:3000', {
  auth: { adminToken: 'admin123' }
});

socket.on('connect', () => {
  console.log('Connected to socket');
});

socket.on('AUTH_STATE', (data) => {
  console.log('AUTH_STATE received:', data);
  process.exit(0);
});

setTimeout(() => {
  console.log('Timeout waiting for AUTH_STATE');
  process.exit(1);
}, 2000);
