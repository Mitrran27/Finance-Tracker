import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';
import { startReminderCron } from './reminder.js';

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
import goalsRoutes         from './routes/goals.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.CLIENT_URL || 'http://localhost:5173',
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`,
    ];
    if (allowed.includes(origin)) return callback(null, true);
    callback(null, true); // permissive for local dev
  },
  credentials: true,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.options('*', cors());
app.use(express.json());

// ── Swagger UI ────────────────────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Finance Tracker API Docs',
  swaggerOptions: { persistAuthorization: true, url: '/api/docs.json' },
}));
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

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
app.use('/api/goals',         goalsRoutes);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Finance Tracker API running at http://localhost:${PORT}`);
  console.log(`📖 Swagger docs at   http://localhost:${PORT}/api/docs`);
  // Start daily reminder cron after server is ready
  startReminderCron();
});
