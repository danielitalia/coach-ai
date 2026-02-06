const express = require('express');
const crypto = require('crypto');
const db = require('../../db/database-multitenant');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  requireAuth
} = require('../middleware/auth');

const router = express.Router();

// ========== REGISTRAZIONE ==========

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, gymName } = req.body;

    // Validazione
    if (!email || !password || !name || !gymName) {
      return res.status(400).json({
        error: 'Campi obbligatori: email, password, name, gymName'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'La password deve avere almeno 8 caratteri'
      });
    }

    // Verifica email non esistente
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email già registrata' });
    }

    // Crea utente
    const user = await db.createUser({ email, password, name });

    // Crea tenant (palestra)
    const tenant = await db.createTenant({
      name: gymName,
      coachName: 'Coach AI',
      plan: 'trial'
    });

    // Collega utente come owner
    await db.addUserToTenant(user.id, tenant.id, 'owner');

    // Genera token
    const accessToken = generateAccessToken(user, tenant.id);
    const refreshToken = generateRefreshToken(user);

    // Salva sessione
    const bcrypt = require('bcryptjs');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 giorni

    await db.createSession(
      user.id,
      refreshTokenHash,
      req.headers['user-agent'],
      req.ip,
      expiresAt
    );

    // Log
    await db.addAuditLog(tenant.id, user.id, 'USER_REGISTERED', 'user', user.id, { email }, req.ip);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

// ========== LOGIN ==========

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password richiesti' });
    }

    // Trova utente
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    // Verifica password
    const valid = await db.verifyPassword(user, password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    // Ottieni tenant dell'utente
    const tenants = await db.getUserTenants(user.id);
    const defaultTenant = tenants[0]; // Primo tenant come default

    // Genera token
    const accessToken = generateAccessToken(user, defaultTenant?.id);
    const refreshToken = generateRefreshToken(user);

    // Salva sessione
    const bcrypt = require('bcryptjs');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.createSession(
      user.id,
      refreshTokenHash,
      req.headers['user-agent'],
      req.ip,
      expiresAt
    );

    // Aggiorna last_login
    await db.pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        role: t.role
      })),
      currentTenant: defaultTenant ? {
        id: defaultTenant.id,
        name: defaultTenant.name,
        slug: defaultTenant.slug,
        role: defaultTenant.role
      } : null,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Errore durante il login' });
  }
});

// ========== REFRESH TOKEN ==========

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token richiesto' });
    }

    // Verifica token
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Refresh token non valido' });
    }

    // Carica utente
    const user = await db.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Utente non trovato' });
    }

    // Ottieni tenant
    const tenants = await db.getUserTenants(user.id);
    const tenantId = req.headers['x-tenant-id'] || tenants[0]?.id;

    // Genera nuovo access token
    const accessToken = generateAccessToken(user, tenantId);

    res.json({ accessToken });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Errore refresh token' });
  }
});

// ========== LOGOUT ==========

router.post('/logout', requireAuth, async (req, res) => {
  try {
    // Cancella tutte le sessioni dell'utente
    await db.deleteUserSessions(req.user.id);

    res.json({ success: true, message: 'Logout effettuato' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Errore durante il logout' });
  }
});

// ========== ME (profilo utente corrente) ==========

router.get('/me', requireAuth, async (req, res) => {
  try {
    const tenants = await db.getUserTenants(req.user.id);

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        avatarUrl: req.user.avatar_url,
        emailVerified: req.user.email_verified
      },
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        role: t.role,
        whatsappConnected: t.whatsapp_connected
      }))
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Errore caricamento profilo' });
  }
});

// ========== SWITCH TENANT ==========

router.post('/switch-tenant', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID richiesto' });
    }

    // Verifica accesso
    const role = await db.getUserTenantRole(req.user.id, tenantId);
    if (!role) {
      return res.status(403).json({ error: 'Accesso negato a questo tenant' });
    }

    const tenant = await db.getTenant(tenantId);

    // Genera nuovo token con questo tenant
    const accessToken = generateAccessToken(req.user, tenantId);

    res.json({
      accessToken,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role
      }
    });
  } catch (error) {
    console.error('Switch tenant error:', error);
    res.status(500).json({ error: 'Errore cambio tenant' });
  }
});

// ========== FORGOT PASSWORD ==========

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email richiesta' });
    }

    const user = await db.getUserByEmail(email);

    // Non rivelare se l'email esiste o no
    if (!user) {
      return res.json({
        success: true,
        message: 'Se l\'email esiste, riceverai un link per il reset'
      });
    }

    // Genera token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 ora

    await db.setPasswordResetToken(email, token, expires);

    // TODO: Inviare email con link
    // Per ora restituiamo il token (solo in development)
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    console.log('Password reset URL:', resetUrl);

    res.json({
      success: true,
      message: 'Se l\'email esiste, riceverai un link per il reset',
      // Solo per development:
      ...(process.env.NODE_ENV !== 'production' && { resetUrl })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Errore richiesta reset password' });
  }
});

// ========== RESET PASSWORD ==========

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token e password richiesti' });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'La password deve avere almeno 8 caratteri'
      });
    }

    const user = await db.getUserByResetToken(token);

    if (!user) {
      return res.status(400).json({ error: 'Token non valido o scaduto' });
    }

    // Aggiorna password
    await db.updateUserPassword(user.id, password);

    // Rimuovi token
    await db.clearPasswordResetToken(user.id);

    // Invalida tutte le sessioni
    await db.deleteUserSessions(user.id);

    res.json({ success: true, message: 'Password aggiornata con successo' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Errore reset password' });
  }
});

// ========== CHANGE PASSWORD ==========

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Password attuale e nuova richieste' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'La nuova password deve avere almeno 8 caratteri'
      });
    }

    // Verifica password attuale
    const user = await db.getUserByEmail(req.user.email);
    const valid = await db.verifyPassword(user, currentPassword);

    if (!valid) {
      return res.status(401).json({ error: 'Password attuale non corretta' });
    }

    // Aggiorna password
    await db.updateUserPassword(req.user.id, newPassword);

    res.json({ success: true, message: 'Password cambiata con successo' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Errore cambio password' });
  }
});

module.exports = router;
