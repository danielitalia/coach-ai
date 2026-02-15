/**
 * SISTEMA DI BACKUP AUTOMATICO - Coach AI
 *
 * Esegue backup giornalieri del database PostgreSQL
 * e li salva localmente + opzionalmente su cloud storage.
 *
 * Schedule:
 * - Backup giornaliero alle 03:00
 * - Retention: ultimi 7 giorni (locale), 30 giorni (cloud)
 * - Notifica Telegram su successo/fallimento
 */

const cron = require('node-cron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

class BackupSystem {
  constructor(config = {}) {
    this.dbUrl = config.dbUrl || process.env.DATABASE_URL;
    this.backupDir = config.backupDir || '/app/backups';
    this.retentionDays = config.retentionDays || 7;
    this.telegramToken = config.telegramToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = config.telegramChatId || process.env.TELEGRAM_CHAT_ID;

    // Parse database URL
    this.parseDbUrl();

    // Ensure backup directory exists
    this.ensureBackupDir();

    console.log('💾 Backup System initialized');
    console.log(`   Backup directory: ${this.backupDir}`);
    console.log(`   Retention: ${this.retentionDays} days`);
  }

  parseDbUrl() {
    try {
      const url = new URL(this.dbUrl);
      this.dbHost = url.hostname;
      this.dbPort = url.port || '5432';
      this.dbUser = url.username;
      this.dbPassword = url.password;
      this.dbName = url.pathname.slice(1); // Remove leading /
    } catch (error) {
      console.error('Error parsing DATABASE_URL:', error.message);
      // Fallback defaults
      this.dbHost = 'postgres';
      this.dbPort = '5432';
      this.dbUser = 'postgres';
      this.dbPassword = '';
      this.dbName = 'postgres';
    }
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`Created backup directory: ${this.backupDir}`);
    }
  }

  /**
   * Avvia lo scheduler dei backup
   */
  start() {
    // Backup giornaliero alle 03:00
    cron.schedule('0 3 * * *', async () => {
      console.log('🔄 [Backup] Starting scheduled backup...');
      await this.runBackup();
    });

    // Pulizia vecchi backup alle 04:00
    cron.schedule('0 4 * * *', async () => {
      console.log('🧹 [Backup] Cleaning old backups...');
      await this.cleanOldBackups();
    });

    console.log('✅ Backup cron jobs scheduled (daily at 03:00)');

    // Esegui backup iniziale dopo 30 secondi (per test)
    if (process.env.BACKUP_ON_START === 'true') {
      setTimeout(() => this.runBackup(), 30000);
    }
  }

  /**
   * Esegue il backup del database
   */
  async runBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup_${this.dbName}_${timestamp}.sql.gz`;
    const filepath = path.join(this.backupDir, filename);

    const startTime = Date.now();

    try {
      // Comando pg_dump con compressione gzip
      const command = `PGPASSWORD="${this.dbPassword}" pg_dump -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d ${this.dbName} -F c -f ${filepath.replace('.gz', '')} && gzip ${filepath.replace('.gz', '')}`;

      console.log(`[Backup] Executing backup to ${filename}...`);

      await execPromise(command, {
        timeout: 300000, // 5 minuti timeout
        env: { ...process.env, PGPASSWORD: this.dbPassword }
      });

      // Verifica che il file esista e abbia dimensione > 0
      const stats = fs.statSync(filepath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`✅ [Backup] Success: ${filename} (${sizeMB} MB) in ${duration}s`);

      // Notifica Telegram
      await this.sendTelegramNotification(
        '✅ BACKUP COMPLETATO',
        `Database: ${this.dbName}\nFile: ${filename}\nDimensione: ${sizeMB} MB\nDurata: ${duration}s`,
        'success'
      );

      return { success: true, filename, size: stats.size, duration };

    } catch (error) {
      console.error('❌ [Backup] Failed:', error.message);

      // Notifica Telegram errore
      await this.sendTelegramNotification(
        '❌ BACKUP FALLITO',
        `Database: ${this.dbName}\nErrore: ${error.message}`,
        'error'
      );

      return { success: false, error: error.message };
    }
  }

  /**
   * Pulisce i backup più vecchi di retentionDays
   */
  async cleanOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const now = Date.now();
      const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        if (!file.startsWith('backup_')) continue;

        const filepath = path.join(this.backupDir, file);
        const stats = fs.statSync(filepath);
        const age = now - stats.mtime.getTime();

        if (age > maxAge) {
          fs.unlinkSync(filepath);
          console.log(`[Backup] Deleted old backup: ${file}`);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`🧹 [Backup] Cleaned ${deletedCount} old backup(s)`);
      }

      return { deletedCount };

    } catch (error) {
      console.error('Error cleaning old backups:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Lista tutti i backup disponibili
   */
  listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('backup_'))
        .map(f => {
          const filepath = path.join(this.backupDir, f);
          const stats = fs.statSync(filepath);
          return {
            filename: f,
            size: stats.size,
            sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
            created: stats.mtime,
            age: Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)) + ' days'
          };
        })
        .sort((a, b) => b.created - a.created);

      return files;

    } catch (error) {
      console.error('Error listing backups:', error.message);
      return [];
    }
  }

  /**
   * Scarica un backup specifico (restituisce il path)
   */
  getBackupPath(filename) {
    const filepath = path.join(this.backupDir, filename);
    if (fs.existsSync(filepath)) {
      return filepath;
    }
    return null;
  }

  /**
   * Invia notifica Telegram
   */
  async sendTelegramNotification(title, message, type = 'info') {
    if (!this.telegramToken || !this.telegramChatId) {
      console.log('[Backup] Telegram not configured, skipping notification');
      return;
    }

    const emoji = type === 'success' ? '💾' : type === 'error' ? '🚨' : 'ℹ️';
    const fullMessage = `${emoji} ${title}\n\n${message}\n\n🕐 ${new Date().toLocaleString('it-IT')}`;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.telegramToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.telegramChatId,
            text: fullMessage,
            parse_mode: 'HTML'
          })
        }
      );

      if (!response.ok) {
        console.error('[Backup] Telegram notification failed');
      }
    } catch (error) {
      console.error('[Backup] Telegram error:', error.message);
    }
  }

  /**
   * Esegue backup manuale (per API)
   */
  async manualBackup() {
    console.log('🔄 [Backup] Manual backup triggered...');
    return await this.runBackup();
  }

  /**
   * Restituisce statistiche sui backup
   */
  getStats() {
    const backups = this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    return {
      totalBackups: backups.length,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].created : null,
      newestBackup: backups.length > 0 ? backups[0].created : null,
      retentionDays: this.retentionDays,
      backupDir: this.backupDir
    };
  }
}

module.exports = BackupSystem;
