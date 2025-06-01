// Simple audit logger middleware

const auditLogger = (req, res, next) => {
  console.log(`[AUDIT] ${req.method} ${req.originalUrl} from IP ${req.ip}`);
  next();
};

module.exports = auditLogger;
