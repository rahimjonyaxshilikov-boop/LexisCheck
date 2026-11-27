import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { AppStore } from './src/server/store';

function getRequestOrigin(req: express.Request): string {
  const protoHeader = req.header('x-forwarded-proto');
  const rawProto = protoHeader ? protoHeader.split(',')[0].trim().toLowerCase() : req.protocol;
  const proto = rawProto === 'https' || rawProto === 'http' ? rawProto : 'https';
  const rawHost = (req.header('x-forwarded-host') || req.get('host') || 'localhost:3000')
    .split(',')[0]
    .trim();
  const safeHost = /^[a-zA-Z0-9.-]+(:\d+)?$/.test(rawHost) ? rawHost : 'localhost:3000';
  return `${proto}://${safeHost}`;
}

function getCliArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === flag && args[i + 1] && !args[i + 1].startsWith('--')) {
      return args[i + 1];
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

const cliPort = getCliArg('--port');
const cliHost = getCliArg('--host');
const envPort =
  process.env.PORT &&
  process.env.NGINX_PORT &&
  process.env.PORT === process.env.NGINX_PORT
    ? process.env.DEFAULT_APP_PORT || '3000'
    : process.env.PORT;
const PORT = Number(cliPort || envPort || 3000);
const HOST = cliHost || '0.0.0.0';
const DB_PATH = path.resolve(process.cwd(), '.data', 'vocab-app.json');

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const store = new AppStore(DB_PATH);

  // Student entry (creates new account or resumes existing profile)
  app.post('/api/student/enter', (req, res) => {
    const { fullName, className } = req.body ?? {};
    const existingToken = req.header('x-student-token') ?? undefined;
    if (typeof fullName !== 'string' || typeof className !== 'string') {
      res.status(400).json({ error: "Ism-familiya va sinf kiritilishi shart." });
      return;
    }

    const result = store.enterStudent(fullName, className, existingToken);
    if (!result.ok) {
      res.status(400).json({
        error: result.error,
        code: result.code,
        suggestedName: result.suggestedName,
      });
      return;
    }

    res.json({
      status: result.status,
      profile: result.profile,
      token: result.token,
    });
  });

  // Lookup whether student has entered previously
  app.get('/api/student/lookup', (req, res) => {
    const fullName = typeof req.query.fullName === 'string' ? req.query.fullName : '';
    const className = typeof req.query.className === 'string' ? req.query.className : undefined;
    res.json(store.lookupStudent(fullName, className));
  });

  // Fetch own profile
  app.get('/api/student/profile', (req, res) => {
    const token = req.header('x-student-token') ?? undefined;
    const profile = store.getStudentByToken(token);
    if (!profile) {
      res.status(401).json({ error: "Sessiya topilmadi." });
      return;
    }
    res.json({ profile });
  });

  // Save test attempt
  app.post('/api/student/attempt', (req, res) => {
    const token = req.header('x-student-token') ?? undefined;
    const attempt = req.body?.attempt;
    if (!attempt || typeof attempt.unitNumber !== 'number') {
      res.status(400).json({ error: "Test natijasi ma'lumotlari noto'g'ri." });
      return;
    }

    const result = store.recordAttempt(token, attempt);
    if (!result.ok) {
      res.status(401).json({ error: result.error });
      return;
    }

    res.json({ profile: result.profile, attempt: result.attempt });
  });

  // Mark unit vocabulary as fully memorized (required before starting test)
  app.post('/api/student/study-complete', (req, res) => {
    const token = req.header('x-student-token') ?? undefined;
    const unitNumber = Number(req.body?.unitNumber);
    if (!Number.isInteger(unitNumber)) {
      res.status(400).json({ error: "Unit raqami noto'g'ri." });
      return;
    }

    const result = store.markUnitStudied(token, unitNumber);
    if (!result.ok) {
      res.status(result.error.includes('Unit') ? 400 : 401).json({ error: result.error });
      return;
    }

    res.json({ profile: result.profile });
  });

  // Teacher authentication
  app.post('/api/teacher/login', (req, res) => {
    const { password } = req.body ?? {};
    if (typeof password !== 'string') {
      res.status(400).json({ error: 'Parol kiritilmadi.' });
      return;
    }
    const result = store.loginTeacher(password);
    if (!result.ok) {
      res.status(401).json({ error: result.error });
      return;
    }
    res.json({ token: result.token });
  });

  // Teacher dashboard data
  app.get('/api/teacher/dashboard', (req, res) => {
    const token = req.header('x-teacher-token') ?? undefined;
    const result = store.getTeacherDashboard(token);
    if (!result.ok) {
      res.status(401).json({ error: result.error });
      return;
    }
    res.json({ students: result.students });
  });

  // Teacher change password
  app.post('/api/teacher/change-password', (req, res) => {
    const token = req.header('x-teacher-token') ?? undefined;
    const { oldPassword, newPassword, confirmPassword } = req.body ?? {};
    if (
      typeof oldPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      typeof confirmPassword !== 'string'
    ) {
      res.status(400).json({ error: "Barcha parol maydonlarini to'ldiring." });
      return;
    }

    const result = store.changeTeacherPassword(
      token,
      oldPassword,
      newPassword,
      confirmPassword,
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ ok: true });
  });

  // Record fullscreen exit / tab-switch anti-cheat event for active student
  app.post('/api/student/anticheat-event', (req, res) => {
    const token = req.header('x-student-token') ?? undefined;
    const { unitNumber, unitTitle, eventType, awaySeconds } = req.body ?? {};
    const validTypes = new Set(['fullscreen_exit', 'tab_switch', 'away_return']);
    if (
      !Number.isInteger(Number(unitNumber)) ||
      typeof unitTitle !== 'string' ||
      typeof eventType !== 'string' ||
      !validTypes.has(eventType)
    ) {
      res.status(400).json({ error: "Nazorat ma'lumotlari noto'g'ri." });
      return;
    }

    const result = store.recordCheatEvent(token, {
      unitNumber: Number(unitNumber),
      unitTitle,
      eventType: eventType as 'fullscreen_exit' | 'tab_switch' | 'away_return',
      awaySeconds: typeof awaySeconds === 'number' ? awaySeconds : undefined,
    });
    if (!result.ok) {
      res.status(result.error.includes('Unit') ? 400 : 401).json({ error: result.error });
      return;
    }

    res.json({ profile: result.profile });
  });

  // Get active test timer duration (default 15 minutes)
  app.get('/api/settings/timer', (_req, res) => {
    res.json({ testDurationMinutes: store.getTestDurationMinutes() });
  });

  // Teacher update test timer duration
  app.post('/api/teacher/test-timer', (req, res) => {
    const token = req.header('x-teacher-token') ?? undefined;
    const { minutes } = req.body ?? {};
    const result = store.setTestDurationMinutes(token, minutes);
    if (!result.ok) {
      const status = result.error.includes('sessiyasi') ? 401 : 400;
      res.status(status).json({ error: result.error });
      return;
    }
    res.json({ ok: true, testDurationMinutes: result.testDurationMinutes });
  });

  // Teacher can clear a student's cheat warning logs
  app.delete('/api/teacher/student/:id/cheat-logs', (req, res) => {
    const token = req.header('x-teacher-token') ?? undefined;
    const result = store.clearStudentCheatLogs(token, req.params.id);
    if (!result.ok) {
      res.status(result.error === "O'quvchi topilmadi." ? 404 : 401).json({
        error: result.error,
      });
      return;
    }
    res.json({ ok: true, student: result.student });
  });

  // Teacher can delete/reset a student account if needed
  app.delete('/api/teacher/student/:id', (req, res) => {
    const token = req.header('x-teacher-token') ?? undefined;
    const result = store.removeStudentAccount(token, req.params.id);
    if (!result.ok) {
      res.status(result.error === "O'quvchi topilmadi." ? 404 : 401).json({
        error: result.error,
      });
      return;
    }
    res.json({ ok: true });
  });

  // Explicit SEO & Google Search Console verification routes (never shadowed by SPA fallback)
  app.get(/^\/(google[a-zA-Z0-9]+\.html)$/, (req, res, next) => {
    const filename = path.basename(req.params[0]);
    const candidates = [
      path.resolve(process.cwd(), 'public', filename),
      path.resolve(process.cwd(), 'dist', filename),
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.send(fs.readFileSync(filePath, 'utf8'));
        return;
      }
    }
    next();
  });

  app.get('/robots.txt', (req, res) => {
    const origin = getRequestOrigin(req);
    res.type('text/plain; charset=utf-8');
    res.send(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = getRequestOrigin(req);
    const today = new Date().toISOString().slice(0, 10);
    res.type('application/xml; charset=utf-8');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`);
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`LexisCheck server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start LexisCheck server:', err);
  process.exit(1);
});
