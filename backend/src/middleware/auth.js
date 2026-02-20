const jwt = require('jsonwebtoken');
const db = require('../../db/database-multitenant');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Genera access token (breve durata)
function generateAccessToken(user, tenantId = null) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      tenantId: tenantId
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Genera refresh token (lunga durata)
function generateRefreshToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

// Verifica token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware: richiede autenticazione
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Token non valido o scaduto' });
    }

    // Carica utente
    const user = await db.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Utente non trovato' });
    }

    req.user = user;
    req.tenantId = decoded.tenantId;

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Errore autenticazione' });
  }
}

// Middleware: richiede tenant specifico
async function requireTenant(req, res, next) {
  try {
    // Prima verifica autenticazione
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Token non valido o scaduto' });
    }

    // Prendi tenant da header o query
    const tenantId = req.headers['x-tenant-id'] || req.query.tenantId || decoded.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID richiesto' });
    }

    // Verifica che l'utente abbia accesso a questo tenant
    const role = await db.getUserTenantRole(decoded.userId, tenantId);

    if (!role) {
      return res.status(403).json({ error: 'Accesso negato a questo tenant' });
    }

    // Carica dati
    const user = await db.getUserById(decoded.userId);
    const tenant = await db.getTenant(tenantId);

    if (!user || !tenant) {
      return res.status(404).json({ error: 'Utente o tenant non trovato' });
    }

    req.user = user;
    req.tenant = tenant;
    req.tenantId = tenantId;
    req.userRole = role;

    next();
  } catch (error) {
    console.error('Tenant auth error:', error);
    res.status(500).json({ error: 'Errore autenticazione tenant' });
  }
}

// Middleware: richiede superadmin (da usare DOPO requireAuth)
async function requireSuperadmin(req, res, next) {
  try {
    if (!req.user || !req.user.is_superadmin) {
      return res.status(403).json({ error: 'Accesso riservato al superadmin' });
    }
    next();
  } catch (error) {
    console.error('Superadmin check error:', error);
    res.status(500).json({ error: 'Errore verifica superadmin' });
  }
}

// Middleware: richiede ruolo specifico
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({
        error: 'Permessi insufficienti',
        required: roles,
        current: req.userRole
      });
    }
    next();
  };
}

// Middleware opzionale: carica tenant se presente
async function optionalTenant(req, res, next) {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;

    if (tenantId) {
      const tenant = await db.getTenant(tenantId);
      if (tenant) {
        req.tenant = tenant;
        req.tenantId = tenantId;
      }
    }

    next();
  } catch (error) {
    next();
  }
}

// Middleware: identifica tenant da WhatsApp number
async function identifyTenantFromWhatsApp(req, res, next) {
  try {
    // Cerca il numero del destinatario nel messaggio webhook
    const data = req.body;
    let whatsappNumber = null;

    // Evolution API v1.8.7 format
    if (data.instance) {
      const tenant = await db.getTenantByInstanceName(data.instance);
      if (tenant) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
        return next();
      }
    }

    // Fallback: cerca da numero
    if (data.data?.key?.remoteJid) {
      whatsappNumber = data.data.key.remoteJid.replace('@s.whatsapp.net', '');
    }

    if (whatsappNumber) {
      const tenant = await db.getTenantByWhatsApp(whatsappNumber);
      if (tenant) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
        return next();
      }
    }

    // Nessun tenant trovato — non processare il messaggio
    console.warn('⚠️ Webhook: tenant non identificato per instance:', data.instance || 'unknown');
    req.tenant = null;
    req.tenantId = null;

    next();
  } catch (error) {
    console.error('Error identifying tenant:', error);
    next();
  }
}

module.exports = {
  JWT_SECRET,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  requireAuth,
  requireSuperadmin,
  requireTenant,
  requireRole,
  optionalTenant,
  identifyTenantFromWhatsApp
};
