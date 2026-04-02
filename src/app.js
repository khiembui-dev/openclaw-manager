'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const config = require('./config');
const logger = require('./utils/logger');

const app = express();

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Security headers - allow Google Fonts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
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

// Ensure data directory exists BEFORE session store init
const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Session - with error handling
let sessionStore;
try {
  const SQLiteStore = require('connect-sqlite3')(session);
  sessionStore = new SQLiteStore({ dir: dbDir, db: 'sessions.db' });
} catch (err) {
  logger.warn('SQLite session store failed, using memory store:', err.message);
  sessionStore = undefined; // Falls back to MemoryStore
}

app.use(session({
  store: sessionStore,
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true, // Changed: need session for CSRF on first visit
  name: 'ocm.sid',
  cookie: {
    secure: false, // Set true only if behind HTTPS proxy
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
  },
}));

// CSRF token generation
app.use((req, res, next) => {
  try {
    if (!req.session) {
      // Session not available - create a fallback token
      res.locals.csrfToken = '';
      return next();
    }
    if (!req.session.csrfToken) {
      req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
  } catch (e) {
    res.locals.csrfToken = '';
  }
  next();
});

// CSRF validation for state-changing requests
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  // Skip CSRF for API routes
  if (req.path.startsWith('/api/')) return next();

  const token = req.body._csrf || req.headers['x-csrf-token'];

  // If no session or no csrf token stored, allow (first-time setup)
  if (!req.session || !req.session.csrfToken) return next();

  if (token && token === req.session.csrfToken) return next();

  // CSRF failed - redirect back with error instead of JSON
  logger.warn('CSRF validation failed for:', req.path);
  return res.redirect('back');
});

// Make common data available to all views
app.use((req, res, next) => {
  res.locals.user = (req.session && req.session.user) || null;
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
  message: { error: 'Qua nhieu lan thu. Vui long doi 1 phut.' },
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

// Setup check - must be before requireAuth
app.get('/setup', requireSetup, (req, res) => {
  res.render('setup', { title: 'Thiet lap ban dau' });
});

// Protected routes
app.use('/', requireAuth, pageRoutes);
app.use('/api', requireAuth, apiRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('error', { title: 'Khong tim thay', message: 'Trang khong ton tai', code: 404 });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  const code = err.status || 500;
  if (req.path.startsWith('/api/')) {
    return res.status(code).json({ error: err.message || 'Internal server error' });
  }
  res.status(code).render('error', {
    title: 'Loi',
    message: config.nodeEnv === 'production' ? 'Da xay ra loi' : err.message,
    code,
  });
});

module.exports = app;
