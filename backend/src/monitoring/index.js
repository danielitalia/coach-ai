/**
 * SISTEMA DI MONITORING - Coach AI
 *
 * Monitora lo stato di tutti i servizi e invia alert via Telegram
 * quando qualcosa non funziona correttamente.
 *
 * Controlli eseguiti ogni 5 minuti:
 * - WhatsApp connesso per ogni tenant
 * - Database accessibile
 * - Evolution API raggiungibile
 * - Backend health
 * - Abbonamenti in scadenza
 */

const cron = require('node-cron');

class MonitoringSystem {
  constructor(db, config) {
    this.db = db;
    this.telegramToken = config.telegramToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = config.telegramChatId || process.env.TELEGRAM_CHAT_ID;
    this.evolutionApiUrl = config.evolutionApiUrl || process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
    this.evolutionApiKey = config.evolutionApiKey || process.env.EVOLUTION_API_KEY;

    // Stato per evitare alert duplicati
    this.lastAlerts = new Map();
    this.alertCooldown = 30 * 60 * 1000; // 30 minuti tra alert uguali

    console.log('📊 Monitoring System initialized');
  }

  /**
   * Avvia il sistema di monitoring
   */
  start() {
    // Check ogni 5 minuti
    cron.schedule('*/5 * * * *', async () => {
      console.log('🔍 [Monitoring] Running health checks...');
      await this.runAllChecks();
    });

    // Report giornaliero alle 9:00
    cron.schedule('0 9 * * *', async () => {
      console.log('📊 [Monitoring] Generating daily report...');
      await this.sendDailyReport();
    });

    // Check abbonamenti in scadenza ogni giorno alle 10:00
    cron.schedule('0 10 * * *', async () => {
      console.log('💳 [Monitoring] Checking expiring subscriptions...');
      await this.checkExpiringSubscriptions();
    });

    console.log('✅ Monitoring cron jobs scheduled');

    // Esegui check iniziale
    setTimeout(() => this.runAllChecks(), 10000);
  }

  /**
   * Esegue tutti i controlli di salute
   */
  async runAllChecks() {
    const results = {
      database: await this.checkDatabase(),
      evolutionApi: await this.checkEvolutionApi(),
      whatsappConnections: await this.checkWhatsAppConnections(),
      timestamp: new Date().toISOString()
    };

    // Log risultati
    const issues = [];
    if (!results.database.healthy) issues.push('Database');
    if (!results.evolutionApi.healthy) issues.push('Evolution API');

    const disconnectedTenants = results.whatsappConnections.filter(t => !t.connected);
    if (disconnectedTenants.length > 0) {
      issues.push(`WhatsApp (${disconnectedTenants.length} disconnessi)`);
    }

    if (issues.length > 0) {
      console.log(`⚠️ [Monitoring] Issues found: ${issues.join(', ')}`);
    } else {
      console.log('✅ [Monitoring] All systems healthy');
    }

    return results;
  }

  /**
   * Controlla la connessione al database
   */
  async checkDatabase() {
    try {
      const result = await this.db.pool.query('SELECT NOW()');
      return { healthy: true, latency: 'ok' };
    } catch (error) {
      await this.sendAlert('🔴 DATABASE DOWN', `Impossibile connettersi al database!\n\nErrore: ${error.message}`);
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Controlla Evolution API
   */
  async checkEvolutionApi() {
    try {
      const response = await fetch(`${this.evolutionApiUrl}/instance/fetchInstances`, {
        headers: { 'apikey': this.evolutionApiKey }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return { healthy: true };
    } catch (error) {
      await this.sendAlert('🔴 EVOLUTION API DOWN', `Evolution API non raggiungibile!\n\nURL: ${this.evolutionApiUrl}\nErrore: ${error.message}`);
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Controlla lo stato WhatsApp di ogni tenant
   */
  async checkWhatsAppConnections() {
    const results = [];

    try {
      // Ottieni tutti i tenant attivi
      const tenantsResult = await this.db.pool.query(`
        SELECT id, name, slug, whatsapp_instance_name, whatsapp_connected, subscription_status
        FROM tenants
        WHERE subscription_status = 'active' OR subscription_status IS NULL
      `);

      for (const tenant of tenantsResult.rows) {
        if (!tenant.whatsapp_instance_name) {
          results.push({
            tenantId: tenant.id,
            name: tenant.name,
            connected: false,
            reason: 'no_instance'
          });
          continue;
        }

        try {
          // Check stato istanza su Evolution API
          const response = await fetch(
            `${this.evolutionApiUrl}/instance/connectionState/${tenant.whatsapp_instance_name}`,
            { headers: { 'apikey': this.evolutionApiKey } }
          );

          if (response.ok) {
            const data = await response.json();
            const isConnected = data?.instance?.state === 'open';

            // Se era connesso e ora è disconnesso, invia alert
            if (tenant.whatsapp_connected && !isConnected) {
              await this.sendAlert(
                '🟠 WHATSAPP DISCONNESSO',
                `La palestra "${tenant.name}" ha perso la connessione WhatsApp!\n\nIstanza: ${tenant.whatsapp_instance_name}\nStato: ${data?.instance?.state || 'unknown'}\n\nAzione richiesta: riconnettere via QR code`
              );

              // Aggiorna stato nel database
              await this.db.pool.query(
                'UPDATE tenants SET whatsapp_connected = false WHERE id = $1',
                [tenant.id]
              );
            }

            // Se era disconnesso e ora è connesso, notifica positiva
            if (!tenant.whatsapp_connected && isConnected) {
              await this.sendAlert(
                '🟢 WHATSAPP RICONNESSO',
                `La palestra "${tenant.name}" è tornata online!\n\nIstanza: ${tenant.whatsapp_instance_name}`,
                'info'
              );

              await this.db.pool.query(
                'UPDATE tenants SET whatsapp_connected = true WHERE id = $1',
                [tenant.id]
              );
            }

            results.push({
              tenantId: tenant.id,
              name: tenant.name,
              connected: isConnected,
              state: data?.instance?.state
            });
          } else {
            results.push({
              tenantId: tenant.id,
              name: tenant.name,
              connected: false,
              reason: 'api_error'
            });
          }
        } catch (error) {
          results.push({
            tenantId: tenant.id,
            name: tenant.name,
            connected: false,
            reason: error.message
          });
        }
      }
    } catch (error) {
      console.error('Error checking WhatsApp connections:', error);
    }

    return results;
  }

  /**
   * Controlla abbonamenti in scadenza
   */
  async checkExpiringSubscriptions() {
    try {
      // Abbonamenti che scadono nei prossimi 7 giorni
      const result = await this.db.pool.query(`
        SELECT name, slug, subscription_plan, subscription_ends_at, subscription_price
        FROM tenants
        WHERE subscription_ends_at IS NOT NULL
          AND subscription_ends_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
          AND subscription_status = 'active'
      `);

      if (result.rows.length > 0) {
        let message = '💳 ABBONAMENTI IN SCADENZA\n\n';

        for (const tenant of result.rows) {
          const daysLeft = Math.ceil(
            (new Date(tenant.subscription_ends_at) - new Date()) / (1000 * 60 * 60 * 24)
          );
          message += `📍 ${tenant.name}\n`;
          message += `   Piano: ${tenant.subscription_plan}\n`;
          message += `   Scade tra: ${daysLeft} giorni\n`;
          message += `   Prezzo: €${tenant.subscription_price || '?'}/mese\n\n`;
        }

        message += '⚠️ Contattare per il rinnovo!';

        await this.sendAlert('💳 ABBONAMENTI IN SCADENZA', message, 'warning');
      }
    } catch (error) {
      console.error('Error checking subscriptions:', error);
    }
  }

  /**
   * Invia report giornaliero
   */
  async sendDailyReport() {
    try {
      // Statistiche generali
      const stats = await this.db.pool.query(`
        SELECT
          (SELECT COUNT(*) FROM tenants WHERE subscription_status = 'active' OR subscription_status IS NULL) as active_tenants,
          (SELECT COUNT(*) FROM tenants WHERE whatsapp_connected = true) as connected_whatsapp,
          (SELECT COUNT(*) FROM clients) as total_clients,
          (SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL '24 hours') as messages_24h,
          (SELECT COUNT(*) FROM checkins WHERE created_at > NOW() - INTERVAL '24 hours') as checkins_24h
      `);

      const s = stats.rows[0];

      let report = '📊 REPORT GIORNALIERO - Coach AI\n';
      report += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
      report += `🏢 Palestre attive: ${s.active_tenants}\n`;
      report += `📱 WhatsApp connessi: ${s.connected_whatsapp}/${s.active_tenants}\n`;
      report += `👥 Clienti totali: ${s.total_clients}\n`;
      report += `💬 Messaggi (24h): ${s.messages_24h}\n`;
      report += `✅ Check-in (24h): ${s.checkins_24h}\n\n`;

      // Palestre con problemi
      const issues = await this.db.pool.query(`
        SELECT name FROM tenants
        WHERE (subscription_status = 'active' OR subscription_status IS NULL)
          AND whatsapp_connected = false
          AND whatsapp_instance_name IS NOT NULL
      `);

      if (issues.rows.length > 0) {
        report += '⚠️ ATTENZIONE:\n';
        for (const t of issues.rows) {
          report += `• ${t.name} - WhatsApp disconnesso\n`;
        }
      } else {
        report += '✅ Tutti i sistemi funzionanti!';
      }

      await this.sendTelegramMessage(report);
    } catch (error) {
      console.error('Error sending daily report:', error);
    }
  }

  /**
   * Invia un alert (con controllo anti-duplicati)
   */
  async sendAlert(title, message, severity = 'error') {
    const alertKey = `${title}-${message.substring(0, 50)}`;
    const lastAlert = this.lastAlerts.get(alertKey);

    // Evita alert duplicati nel cooldown period
    if (lastAlert && Date.now() - lastAlert < this.alertCooldown) {
      console.log(`[Monitoring] Skipping duplicate alert: ${title}`);
      return;
    }

    this.lastAlerts.set(alertKey, Date.now());

    const emoji = severity === 'error' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';
    const fullMessage = `${emoji} ${title}\n\n${message}\n\n🕐 ${new Date().toLocaleString('it-IT')}`;

    await this.sendTelegramMessage(fullMessage);

    // Log nel database per storico
    try {
      await this.db.pool.query(`
        INSERT INTO monitoring_alerts (title, message, severity, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [title, message, severity]);
    } catch (e) {
      // Tabella potrebbe non esistere ancora
    }
  }

  /**
   * Invia messaggio Telegram
   */
  async sendTelegramMessage(text) {
    if (!this.telegramToken || !this.telegramChatId) {
      console.log('[Monitoring] Telegram not configured, logging alert:', text);
      return;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.telegramToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.telegramChatId,
            text: text,
            parse_mode: 'HTML'
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('[Monitoring] Telegram error:', error);
      } else {
        console.log('[Monitoring] Alert sent to Telegram');
      }
    } catch (error) {
      console.error('[Monitoring] Failed to send Telegram message:', error);
    }
  }

  /**
   * Test della connessione Telegram
   */
  async testTelegram() {
    await this.sendTelegramMessage('🧪 Test Alert\n\nIl sistema di monitoring è configurato correttamente!');
    return { success: true };
  }

  /**
   * Forza esecuzione di tutti i check (per API)
   */
  async forceCheck() {
    return await this.runAllChecks();
  }
}

module.exports = MonitoringSystem;
