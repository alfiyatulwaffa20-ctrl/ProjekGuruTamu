const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const indexRoutes = require('./routes/index.routes');
const prisma = require('./config/db');

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET wajib diatur pada environment production.');
}

const app = express();
let currentPort = Number(process.env.PORT) || 3002;

// 1. Konfigurasi View Engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// 2. Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'tefa-workshop-demo-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));

// 3. Global Template Helpers & Variables
app.use((req, res, next) => {
  res.locals.appName = 'TEFA / STUDIO';
  res.locals.schoolName = 'SMK Telkom Lampung';
  res.locals.currentUser = req.session.user || null;
  res.locals.notice = req.query.notice || '';
  res.locals.formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(number || 0);
  };
  res.locals.formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('id-ID', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  next();
});

// 4. Mount Routes
app.use('/', indexRoutes);

app.use((error, req, res, next) => {
  console.error('Request error:', error);
  if (res.headersSent) return next(error);
  res.status(500).render('error', { title: 'Terjadi kesalahan', code: 500, message: 'Permintaan belum dapat diproses. Silakan coba kembali.' });
});

// 5. 404 Route Handler
app.use((req, res) => res.status(404).render('error', { title: 'Halaman tidak ditemukan', code: 404, message: 'Halaman yang Anda cari tidak tersedia.' }));

// 6. Graceful Shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('\n🛑 Server Express & Prisma dimatikan.');
  process.exit(0);
});

// 7. Fungsi Start Server dengan Auto Port Fallback jika Port Sedang Dipakai
function startServer(port) {
  const server = app.listen(port, () => {
    console.log('=======================================================');
    console.log('SISTEM TEACHING FACTORY & ORDER JASA INDUSTRI');
    console.log('SMK Telkom Lampung');
    console.log(`🌐 Akses Server: http://localhost:${port}`);
    console.log('=======================================================');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} sedang digunakan oleh aplikasi lain. Mencoba port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('❌ Server error:', err);
    }
  });
}

startServer(currentPort);
