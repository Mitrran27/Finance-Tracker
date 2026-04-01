/**
 * Reminders routes
 * POST /api/reminders/trigger  — manually fire the reminder job (for testing)
 * GET  /api/reminders/status   — check mailer config status
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { runReminderJob } from '../jobs/sendReminders.js';
import { verifyMailer } from '../services/mailer.js';

const router = Router();
router.use(authenticate);

// Manually trigger reminder check (useful for testing)
router.post('/trigger', async (req, res) => {
  try {
    const result = await runReminderJob();
    res.json({ message: 'Reminder job completed', ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Check if mailer is configured and reachable
router.get('/status', async (req, res) => {
  const configured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  if (!configured) {
    return res.json({
      configured: false,
      message: 'SMTP_USER and SMTP_PASS are not set in .env',
    });
  }
  const ok = await verifyMailer();
  res.json({
    configured,
    connected: ok,
    smtp_host: process.env.SMTP_HOST,
    smtp_port: process.env.SMTP_PORT,
    smtp_user: process.env.SMTP_USER,
    cron_schedule: process.env.REMINDER_CRON || '0 8 * * *',
    message: ok
      ? 'Mailer is connected and ready'
      : 'Mailer config exists but connection failed — check credentials',
  });
});

export default router;
