const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const { ApiError } = require('../utils/errors');
const config = require('../config/config');
const logger = require('../utils/logger');

// Get CSP directives
const getCSPDirectives = () => {
  const directives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
    imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net", "https://secure.gravatar.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
    connectSrc: ["'self'"],
    frameSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  };

  if (config.env === 'production') {
    directives.scriptSrc = ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"];
    directives.upgradeInsecureRequests = [true];
  } else {
    directives.scriptSrc.push("'unsafe-eval'");
    directives.connectSrc.push("ws://localhost:*");
  }

  if (config.features?.telemedicine) {
    directives.connectSrc.push("https://*.zoom.us", "https://*.twilio.com", "wss://*.twilio.com");
    directives.mediaSrc = ["'self'", "https://*.twilio.com"];
    directives.frameSrc.push("https://*.zoom.us", "https://*.twilio.com");
  }

  if (config.features?.analytics) {
    directives.connectSrc.push("https://www.google-analytics.com");
    directives.scriptSrc.push("https://www.google-analytics.com", "https://ssl.google-analytics.com");
  }

  return directives;
};

const getCorsOptions = () => {
  return {
    origin: (origin, callback) => {
      const whitelist = config.security?.cors?.whitelist || [];
      if (!origin || whitelist.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked request from origin: ${origin}`);
        if (config.env === 'development') {
          callback(null, true);
        } else {
          callback(new ApiError('Not allowed by CORS', 403));
        }
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin',
      'X-CSRF-Token', 'X-API-Key', 'X-Client-Version'
    ],
    credentials: true,
    maxAge: 1800,
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
};

// ✅ Export a function that applies all middleware functions
function applySecurityMiddleware(app) {
  app.use(cors(getCorsOptions()));

  app.use(helmet());

  app.use(
    helmet.contentSecurityPolicy({
      directives: getCSPDirectives(),
      reportOnly: config.env === 'development',
    })
  );

  app.use(helmet.xssFilter());
  app.use(helmet.noSniff());
  app.use(helmet.frameguard({ action: 'deny' }));
  app.use(
    helmet.hsts({
      maxAge: 15552000,
      includeSubDomains: true,
      preload: true,
    })
  );
  app.use(helmet.hidePoweredBy());
  app.use(helmet.dnsPrefetchControl({ allow: false }));
  app.use(
    helmet.referrerPolicy({
      policy: 'strict-origin-when-cross-origin',
    })
  );

  app.use((req, res, next) => {
    const permissionsPolicy = config.features?.telemedicine
      ? "camera=self; microphone=self; geolocation=self; display-capture=self"
      : "camera=(); microphone=(); geolocation=(); display-capture=()";
    res.setHeader('Permissions-Policy', permissionsPolicy);
    next();
  });

  app.use((req, res, next) => {
    res.setHeader('Expect-CT', 'enforce, max-age=86400');
    next();
  });

  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  });

  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  });

  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });

  app.use(mongoSanitize({
    allowDots: true,
    replaceWith: '_'
  }));

  app.use(xss());

  app.use(hpp({
    whitelist: [
      'sort', 'fields', 'page', 'limit', 'expand',
      'startDate', 'endDate', 'status',
      'patientId', 'doctorId', 'appointmentDate'
    ]
  }));

  app.use((req, res, next) => {
    const sensitiveRoutes = [
      '/patients',
      '/medical-records',
      '/appointments',
      '/lab-results'
    ];
    const path = req.path.toLowerCase();
    const isSensitiveRoute = sensitiveRoutes.some(route =>
      path.includes(route) || path.startsWith(`/api/${config.apiVersion}${route}`)
    );
    if (isSensitiveRoute) {
      res.setHeader('X-PHI-Warning', 'Contains Protected Health Information - Handle according to HIPAA requirements');
    }
    next();
  });

  app.use((req, res, next) => {
    if (!res.getHeader('Cache-Control')) {
      res.setHeader('Cache-Control', 'no-store, must-revalidate, max-age=0');
    }
    res.setHeader('Pragma', 'no-cache');

    if (config.security?.contactEmail) {
      res.setHeader('X-Security-Contact', config.security.contactEmail);
    }
    next();
  });
}

module.exports = applySecurityMiddleware;

