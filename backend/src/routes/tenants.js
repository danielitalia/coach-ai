const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const db = require('../../db/database-multitenant');
const { requireTenant, requireRole } = require('../middleware/auth');

const router = express.Router();

// Evolution API config
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// ========== TENANT INFO ==========

// Get current tenant info
router.get('/current', requireTenant, async (req, res) => {
  try {
    res.json({
      tenant: {
        id: req.tenant.id,
        name: req.tenant.name,
        slug: req.tenant.slug,
        whatsappNumber: req.tenant.whatsapp_number,
        whatsappConnected: req.tenant.whatsapp_connected,
        coachName: req.tenant.coach_name,
        logoUrl: req.tenant.logo_url,
        primaryColor: req.tenant.primary_color,
        subscriptionPlan: req.tenant.subscription_plan,
        subscriptionStatus: req.tenant.subscription_status,
        trialEndsAt: req.tenant.trial_ends_at
      },
      role: req.userRole
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update tenant settings
router.put('/settings', requireTenant, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const allowedFields = ['name', 'coachName', 'coachPersonality', 'useEmoji', 'logoUrl', 'primaryColor'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const tenant = await db.updateTenant(req.tenantId, updates);

    await db.addAuditLog(req.tenantId, req.user.id, 'TENANT_SETTINGS_UPDATED', 'tenant', req.tenantId, updates, req.ip);

    res.json({ success: true, tenant });
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== TEAM MANAGEMENT ==========

// Get team members
router.get('/team', requireTenant, async (req, res) => {
  try {
    const members = await db.getTenantUsers(req.tenantId);
    res.json(members);
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Invite team member
router.post('/team/invite', requireTenant, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email richiesta' });
    }

    const inviteRole = role || 'staff';
    if (!['admin', 'staff'].includes(inviteRole)) {
      return res.status(400).json({ error: 'Ruolo non valido' });
    }

    // Genera token invito
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 giorni

    await db.pool.query(`
      INSERT INTO invitations (tenant_id, email, role, token, invited_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [req.tenantId, email.toLowerCase(), inviteRole, token, req.user.id, expiresAt]);

    // TODO: Inviare email di invito
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invite?token=${token}`;

    await db.addAuditLog(req.tenantId, req.user.id, 'TEAM_MEMBER_INVITED', 'invitation', null, { email, role: inviteRole }, req.ip);

    res.json({
      success: true,
      message: 'Invito inviato',
      // Solo per development:
      ...(process.env.NODE_ENV !== 'production' && { inviteUrl })
    });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Accept invitation
router.post('/team/accept-invite', async (req, res) => {
  try {
    const { token, password, name } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token richiesto' });
    }

    // Trova invito
    const inviteResult = await db.pool.query(`
      SELECT * FROM invitations
      WHERE token = $1 AND expires_at > NOW() AND accepted_at IS NULL
    `, [token]);

    const invite = inviteResult.rows[0];
    if (!invite) {
      return res.status(400).json({ error: 'Invito non valido o scaduto' });
    }

    // Verifica se utente esiste già
    let user = await db.getUserByEmail(invite.email);

    if (!user) {
      // Crea nuovo utente
      if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password di almeno 8 caratteri richiesta' });
      }
      user = await db.createUser({
        email: invite.email,
        password,
        name: name || invite.email.split('@')[0]
      });
    }

    // Aggiungi al tenant
    await db.addUserToTenant(user.id, invite.tenant_id, invite.role);

    // Segna invito come accettato
    await db.pool.query(
      'UPDATE invitations SET accepted_at = NOW() WHERE id = $1',
      [invite.id]
    );

    await db.addAuditLog(invite.tenant_id, user.id, 'TEAM_MEMBER_JOINED', 'user', user.id, { role: invite.role }, req.ip);

    res.json({ success: true, message: 'Invito accettato' });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update team member role
router.put('/team/:userId/role', requireTenant, requireRole('owner'), async (req, res) => {
  try {
    const { role } = req.body;

    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Ruolo non valido' });
    }

    // Non può cambiare il proprio ruolo
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Non puoi cambiare il tuo ruolo' });
    }

    await db.pool.query(
      'UPDATE user_tenants SET role = $1 WHERE user_id = $2 AND tenant_id = $3',
      [role, req.params.userId, req.tenantId]
    );

    await db.addAuditLog(req.tenantId, req.user.id, 'TEAM_ROLE_CHANGED', 'user', req.params.userId, { newRole: role }, req.ip);

    res.json({ success: true });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove team member
router.delete('/team/:userId', requireTenant, requireRole('owner'), async (req, res) => {
  try {
    // Non può rimuovere se stesso
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Non puoi rimuovere te stesso' });
    }

    await db.removeUserFromTenant(req.params.userId, req.tenantId);

    await db.addAuditLog(req.tenantId, req.user.id, 'TEAM_MEMBER_REMOVED', 'user', req.params.userId, null, req.ip);

    res.json({ success: true });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== WHATSAPP SETUP ==========

// Get WhatsApp status
router.get('/whatsapp/status', requireTenant, async (req, res) => {
  try {
    const instanceName = req.tenant.whatsapp_instance_name || `coach-ai-${req.tenant.slug}`;

    const response = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(() => null);

    const connected = response?.data?.state === 'open';

    // Aggiorna stato nel DB se diverso
    if (connected !== req.tenant.whatsapp_connected) {
      await db.updateTenant(req.tenantId, { whatsappConnected: connected });
    }

    res.json({
      connected,
      state: response?.data?.state || 'unknown',
      instanceName
    });
  } catch (error) {
    console.error('WhatsApp status error:', error);
    res.json({ connected: false, state: 'error' });
  }
});

// Get WhatsApp QR code
router.get('/whatsapp/qr', requireTenant, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const instanceName = req.tenant.whatsapp_instance_name || `coach-ai-${req.tenant.slug}`;

    // Prima verifica se già connesso
    const statusResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(() => null);

    if (statusResponse?.data?.state === 'open') {
      return res.json({
        connected: true,
        message: 'WhatsApp già connesso'
      });
    }

    // Prova a ottenere QR esistente
    try {
      const connectResponse = await axios.get(
        `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
        { headers: { 'apikey': EVOLUTION_API_KEY } }
      );

      if (connectResponse.data?.qrcode?.base64 || connectResponse.data?.base64) {
        return res.json({
          connected: false,
          qrcode: connectResponse.data.qrcode?.base64 || connectResponse.data.base64,
          pairingCode: connectResponse.data.pairingCode
        });
      }
    } catch (e) {
      // Istanza non esiste, creiamola
    }

    // Crea nuova istanza
    const createResponse = await axios.post(
      `${EVOLUTION_API_URL}/instance/create`,
      {
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true
      },
      { headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY } }
    );

    // Salva nome istanza nel tenant
    await db.updateTenant(req.tenantId, { whatsappInstanceName: instanceName });

    // Aspetta e ottieni QR
    await new Promise(resolve => setTimeout(resolve, 2000));

    const qrResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    );

    res.json({
      connected: false,
      qrcode: qrResponse.data?.qrcode?.base64 || qrResponse.data?.base64 || createResponse.data?.qrcode?.base64,
      pairingCode: qrResponse.data?.pairingCode || createResponse.data?.pairingCode
    });
  } catch (error) {
    console.error('WhatsApp QR error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

// Disconnect WhatsApp
router.post('/whatsapp/disconnect', requireTenant, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const instanceName = req.tenant.whatsapp_instance_name;

    if (instanceName) {
      await axios.delete(
        `${EVOLUTION_API_URL}/instance/logout/${instanceName}`,
        { headers: { 'apikey': EVOLUTION_API_KEY } }
      );
    }

    await db.updateTenant(req.tenantId, { whatsappConnected: false });

    await db.addAuditLog(req.tenantId, req.user.id, 'WHATSAPP_DISCONNECTED', 'tenant', req.tenantId, null, req.ip);

    res.json({ success: true, message: 'WhatsApp disconnesso' });
  } catch (error) {
    console.error('WhatsApp disconnect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== STATS ==========

router.get('/stats', requireTenant, async (req, res) => {
  try {
    const stats = await db.getStats(req.tenantId);
    const checkinStats = await db.getCheckinStatsGlobal(req.tenantId);
    const referralStats = await db.getReferralStatsGlobal(req.tenantId);

    res.json({
      ...stats,
      checkins: checkinStats,
      referrals: referralStats
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
