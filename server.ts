import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { AppStore } from './src/server/store';

const PORT = Number(process.env.PORT || 3000);
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

  // Verify cheater unlock code
  app.post('/api/anticheat/unlock', (req, res) => {
    const { code } = req.body ?? {};
    if (typeof code !== 'string') {
      res.status(400).json({ error: 'Kod kiritilmadi.' });
      return;
    }
    if (!store.verifyCheaterCode(code)) {
      res.status(401).json({ error: "Kod notoʻgʻri. Test bloklangan holatda qoladi." });
      return;
    }
    res.json({ ok: true });
  });

  // Teacher change cheater unlock code
  app.post('/api/teacher/change-cheater-code', (req, res) => {
    const token = req.header('x-teacher-token') ?? undefined;
    const { oldCode, newCode, confirmCode } = req.body ?? {};
    if (
      typeof oldCode !== 'string' ||
      typeof newCode !== 'string' ||
      typeof confirmCode !== 'string'
    ) {
      res.status(400).json({ error: "Barcha kod maydonlarini to'ldiring." });
      return;
    }

    const result = store.changeCheaterCode(token, oldCode, newCode, confirmCode);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ ok: true });
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

  // Teacher can delete/reset a locked student account if needed
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LexisCheck server running on http://localhost:${PORT}`);
  });
}

startServer();
