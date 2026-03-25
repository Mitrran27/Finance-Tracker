import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes          from './routes/auth.js';
import banksRoutes         from './routes/banks.js';
import transactionsRoutes  from './routes/transactions.js';
import creditRoutes        from './routes/credit.js';
import driveRoutes         from './routes/drive.js';
import eventsRoutes        from './routes/events.js';
import notesRoutes         from './routes/notes.js';
import notificationsRoutes from './routes/notifications.js';
import settingsRoutes      from './routes/settings.js';
import overviewRoutes      from './routes/overview.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://finance-tracker-theta-fawn.vercel.app'
  ],
  credentials: true,
}));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/banks',         banksRoutes);
app.use('/api/transactions',  transactionsRoutes);
app.use('/api/credit',        creditRoutes);
app.use('/api/drive',         driveRoutes);
app.use('/api/events',        eventsRoutes);
app.use('/api/notes',         notesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/overview',      overviewRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Finance Tracker API running at http://localhost:${PORT}`);
});
