/**
 * 🧠 Brain Module 2: Conversation Analyzer
 *
 * Analizza ogni messaggio del cliente in tempo reale per detectare:
 * - Frustrazione / dolore / blocchi
 * - Motivazione / celebrazioni / progressi
 * - Barriere (mancanza tempo, stanchezza, ecc.)
 *
 * Aggiorna automaticamente il motivation_level nel client_scoring.
 * Zero chiamate AI extra — tutto keyword-based per performance.
 */

// =============================================
// KEYWORD DICTIONARIES (Italian)
// =============================================

const SIGNALS = {
  frustration: {
    keywords: [
      'non riesco', 'non ce la faccio', 'troppo difficile', 'impossibile',
      'non sono capace', 'mi arrendo', 'basta', 'sono negato', 'non miglioro',
      'faccio schifo', 'è inutile', 'non funziona', 'deluso', 'frustrato',
      'demoralizz', 'scoraggi', 'non vedo risultati', 'perdo tempo',
      'non serve a niente', 'mollare', 'lasciare perdere'
    ],
    motivationImpact: -0.3,
    signalType: 'frustration'
  },
  pain: {
    keywords: [
      'fa male', 'mi fa male', 'dolore', 'male alla', 'male al',
      'infortunio', 'infortunato', 'storta', 'strappo', 'contrattura',
      'tendinite', 'mal di schiena', 'mal di ginocchio', 'brucia',
      'blocco', 'bloccato', 'non riesco a muovere', 'fastidio',
      'gonfi', 'infiammaz'
    ],
    motivationImpact: -0.2,
    signalType: 'pain'
  },
  barrier: {
    keywords: [
      'non ho tempo', 'non posso', 'oggi no', 'salto', 'non vengo',
      'lavoro', 'troppo stanco', 'stanchezza', 'impegni', 'non ce la faccio oggi',
      'rimando', 'domani', 'la prossima', 'periodo difficile',
      'troppo impegnato', 'non riesco a venire', 'devo saltare',
      'settimana pesante', 'non ho voglia', 'pigriz'
    ],
    motivationImpact: -0.1,
    signalType: 'barrier'
  },
  motivation: {
    keywords: [
      'motivato', 'carico', 'carica', 'determinato', 'pronto',
      'non vedo l\'ora', 'gasato', 'pumped', 'finalmente',
      'ce la faccio', 'ci riesco', 'sono pronto', 'voglio',
      'obiettivo', 'traguardo', 'sfida', 'mi impegno',
      'da domani', 'nuovo inizio', 'ricominc'
    ],
    motivationImpact: +0.2,
    signalType: 'motivation'
  },
  progress: {
    keywords: [
      'perso', 'dimagrito', 'ho perso', 'kg in meno', 'centimetri',
      'riesco a fare', 'push-up', 'migliorato', 'più forte',
      'più resistenza', 'personal best', 'record', 'aumentato',
      'risultati', 'sono riuscito', 'ce l\'ho fatta', 'progressi',
      'la bilancia', 'peso', 'mi sento meglio', 'più energia',
      'complimenti', 'mi hanno detto'
    ],
    motivationImpact: +0.3,
    signalType: 'progress'
  },
  celebration: {
    keywords: [
      'evviva', 'fantastico', 'bellissimo', 'incredibile', 'wow',
      'top', 'grandioso', 'perfetto', 'sono felice', 'contento',
      'soddisfatto', 'orgoglioso', 'che bello', 'grazie mille',
      'sei grande', 'funziona', 'adoro', 'mi piace',
      'eccezionale', 'super'
    ],
    motivationImpact: +0.2,
    signalType: 'celebration'
  }
};

/**
 * Analizza un messaggio del cliente e ritorna i segnali trovati
 * @param {string} text - Testo del messaggio
 * @returns {Array} Array di segnali trovati
 */
function analyzeMessage(text) {
  if (!text || typeof text !== 'string') return [];

  const lowerText = text.toLowerCase().trim();
  const detectedSignals = [];

  for (const [category, config] of Object.entries(SIGNALS)) {
    const matchedKeywords = config.keywords.filter(kw => lowerText.includes(kw));

    if (matchedKeywords.length > 0) {
      // Calcola confidence basata su quanti keywords matchano
      const confidence = Math.min(1.0, 0.5 + (matchedKeywords.length * 0.15));

      detectedSignals.push({
        signalType: config.signalType,
        keywords: matchedKeywords,
        confidence: Math.round(confidence * 100) / 100,
        motivationImpact: config.motivationImpact,
        text: text.substring(0, 200) // Salva solo i primi 200 caratteri
      });
    }
  }

  return detectedSignals;
}

/**
 * Processa un messaggio e salva i segnali nel DB
 * Aggiorna anche il motivation_level nel client_scoring
 *
 * @param {string} tenantId - Tenant UUID
 * @param {string} phone - Numero telefono cliente
 * @param {string} text - Testo del messaggio
 * @param {object} db - Database module
 */
async function processAndSave(tenantId, phone, text, db) {
  const signals = analyzeMessage(text);

  if (signals.length === 0) return null;

  console.log(`[Brain:Analyzer] 📊 ${phone}: ${signals.length} segnali trovati → ${signals.map(s => s.signalType).join(', ')}`);

  // Salva ogni segnale nel DB
  for (const signal of signals) {
    try {
      await db.pool.query(`
        INSERT INTO conversation_signals (tenant_id, phone, signal_type, signal_text, keywords_matched, confidence)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [tenantId, phone, signal.signalType, signal.text, signal.keywords, signal.confidence]);
    } catch (err) {
      console.error(`[Brain:Analyzer] Errore salvataggio segnale:`, err.message);
    }
  }

  // Calcola il motivation_level aggiornato
  // Guarda gli ultimi 10 segnali per questo cliente
  try {
    const recentSignals = await db.pool.query(`
      SELECT signal_type, confidence
      FROM conversation_signals
      WHERE tenant_id = $1 AND phone = $2
      ORDER BY created_at DESC
      LIMIT 10
    `, [tenantId, phone]);

    if (recentSignals.rows.length > 0) {
      let motivationScore = 0;
      for (const s of recentSignals.rows) {
        const config = Object.values(SIGNALS).find(c => c.signalType === s.signal_type);
        if (config) {
          motivationScore += config.motivationImpact * parseFloat(s.confidence);
        }
      }

      // Normalizza: score positivo = high, neutro = medium, negativo = low
      let motivationLevel = 'medium';
      if (motivationScore > 0.3) motivationLevel = 'high';
      else if (motivationScore < -0.3) motivationLevel = 'low';

      // Aggiorna client_scoring (solo motivation_level)
      await db.pool.query(`
        INSERT INTO client_scoring (tenant_id, phone, motivation_level)
        VALUES ($1, $2, $3)
        ON CONFLICT (tenant_id, phone) DO UPDATE SET
          motivation_level = $3
      `, [tenantId, phone, motivationLevel]);

      console.log(`[Brain:Analyzer] 🎯 ${phone}: motivation_level → ${motivationLevel} (score: ${motivationScore.toFixed(2)})`);
    }
  } catch (err) {
    console.error(`[Brain:Analyzer] Errore aggiornamento motivation:`, err.message);
  }

  return signals;
}

/**
 * Recupera i segnali recenti per un cliente (per il dashboard)
 */
async function getRecentSignals(tenantId, phone, db, limit = 20) {
  const result = await db.pool.query(`
    SELECT signal_type, signal_text, keywords_matched, confidence, created_at
    FROM conversation_signals
    WHERE tenant_id = $1 AND phone = $2
    ORDER BY created_at DESC
    LIMIT $3
  `, [tenantId, phone, limit]);
  return result.rows;
}

/**
 * Recupera statistiche segnali per tenant (per il dashboard)
 */
async function getSignalStats(tenantId, db, days = 30) {
  const result = await db.pool.query(`
    SELECT
      signal_type,
      COUNT(*) as count,
      COUNT(DISTINCT phone) as unique_clients,
      ROUND(AVG(confidence)::numeric, 2) as avg_confidence
    FROM conversation_signals
    WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
    GROUP BY signal_type
    ORDER BY count DESC
  `, [tenantId, days]);
  return result.rows;
}

module.exports = {
  analyzeMessage,
  processAndSave,
  getRecentSignals,
  getSignalStats,
  SIGNALS
};
