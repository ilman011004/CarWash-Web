import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customer.js';
import storeRoutes from './routes/stores.js';
import orderRoutes from './routes/orders.js';
import ownerRoutes from './routes/owner.js';
import employeeRoutes from './routes/employee.js';
import adminRoutes from './routes/admin/index.js';
import chatRoutes from './routes/chats.js';
import trackingRoutes from './routes/tracking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Simpan instance io agar bisa dipanggil dari routes
app.set('io', io);

// WebSocket event handlers
io.on('connection', (socket) => {
  // Join room per pesanan (order_123)
  socket.on('join_order_room', (orderId) => {
    socket.join(`order_${orderId}`);
  });

  socket.on('leave_order_room', (orderId) => {
    socket.leave(`order_${orderId}`);
  });

  socket.on('disconnect', () => { });
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Sajikan berkas statis upload gambar (foto bukti cuci & foto chat)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// Registrasi modul rute
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/tracking', trackingRoutes);

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Terjadi kesalahan di server' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 CarWash API & Socket.io berjalan di http://localhost:${PORT}`);
});
