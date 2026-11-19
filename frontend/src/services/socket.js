import { io } from 'socket.io-client';

// Sambungkan langsung ke port Backend 4000
const socket = io('http://localhost:4000', {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

export default socket;
