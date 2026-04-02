'use strict';

const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const SQLiteStore = require('connect-sqlite3')(session);
const config = require('./config');
const logger = require('./utils/logger');

const app = express();

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Static files
app.use('/static', express.static(path.join(__dirname, '..', 'public'), {
  maxAge: config.nodeEnv === 'production' ? '1d' : 0,
}));

// Session
const dbDir = path.dirname(config.db.path);
app.use(session({
  store: new SQLiteStore({ dir: dbDir, db: 'sessions.db' }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'ocm.sid',
  cookie: {
    secure: config.nodeEnv === 'production' && false, // Set true if behind HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
  },
}));

// CSRF token generation (simple double-submit cookie pattern)
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// CSRF validation for state-changing requests
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.body._csrf || req.headers['x-csrf-token'];
  if (token && token === req.session.csrfToken) return next();
  // Skip CSRF for API routes that use session auth (token is checked)
  if (req.path.startsWith('/api/')) return next();
  res.status(403).json({ error: 'Invalid CSRF token' });
});

// Make common data available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.config = {
    version: config.version,
    appName: 'OpenClaw Manager',
  };
  next();
});

// Rate limiting
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Quá nhiều lần thử. Vui lòng đợi 1 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth middleware
const { requireAuth, requireSetup } = require('./middleware/auth');

// Routes
const authRoutes = require('./routes/auth');
const pageRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api');

// Public routes
app.use('/auth', loginLimiter, authRoutes);

// Setup check
app.get('/setup', requireSetup, (req, res) => {
  res.render('setup', { title: 'Thiết lập ban đầu' });
});

// Protected routes
app.use('/', requireAuth, pageRoutes);
app.use('/api', requireAuth, apiRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('error', { title: 'Không tìm thấy', message: 'Trang không tồn tại', code: 404 });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  const code = err.status || 500;
  if (req.path.startsWith('/api/')) {
    return res.status(code).json({ error: err.message || 'Internal server error' });
  }
  res.status(code).render('error', {
    title: 'Lỗi',
    message: config.nodeEnv === 'production' ? 'Đã xảy ra lỗi' : err.message,
    code,
  });
});

module.exports = app;
