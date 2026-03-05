// WhatsApp QR code alias
app.get('/api/whatsapp/qrcode', legacyTenant, async (req, res) => {
  try {
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';
    console.log('[QR-DEBUG] Richiesta QR per: ' + instanceName);

    // Tentativo di recupero QR (o creazione se fallisce)
    let qrcode = null;
    try {
      const connectResponse = await axios.get(
        `${EVOLUTION_API_URL}/instance/connect/` + instanceName,
        { headers: { 'apikey': EVOLUTION_API_KEY } }
      );
      qrcode = connectResponse.data?.qrcode?.base64 || connectResponse.data?.base64;
    } catch (e) {
      console.log('[QR-DEBUG] Istanza ' + instanceName + ' non pronta, provo a crearla...');
      await axios.post(
        `${EVOLUTION_API_URL}/instance/create`,
        { instanceName: instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true },
        { headers: { 'apikey': EVOLUTION_API_KEY } }
      ).catch(() => null);

      await new Promise(r => setTimeout(r, 4000));
      const qrResponse = await axios.get(
        `${EVOLUTION_API_URL}/instance/connect/` + instanceName,
        { headers: { 'apikey': EVOLUTION_API_KEY } }
      );
      qrcode = qrResponse.data?.qrcode?.base64 || qrResponse.data?.base64;
    }

    if (qrcode && !qrcode.startsWith('data:')) {
      qrcode = 'data:image/png;base64,' + qrcode;
    }

    res.json({ connected: false, qrcode, pairingCode: null });
  } catch (error) {
    console.error('Errore QR WhatsApp:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp disconnect/logout
app.post('/api/whatsapp/disconnect', legacyTenant, async (req, res) => {
  try {
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';
    console.log(`[QR-DEBUG] Disconnessione istanza: ${instanceName}`);
    await axios.delete(
      `${EVOLUTION_API_URL}/instance/logout/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(() => null);
    res.json({ success: true, message: 'Disconnessione effettuata' });
  } catch (error) {
    console.error('Errore disconnessione WhatsApp:', error.message);
    res.json({ success: true, message: 'Istanza già disconnessa o rimossa' });
  }
});

// WhatsApp restart
app.post('/api/whatsapp/restart', legacyTenant, async (req, res) => {
  try {
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';
    console.log(`[QR-DEBUG] Riavvio istanza: ${instanceName}`);
    await axios.post(
      `${EVOLUTION_API_URL}/instance/restart/${instanceName}`,
      {},
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    );
    res.json({ success: true, message: 'Riavvio effettuato' });
  } catch (error) {
    console.error('Errore riavvio WhatsApp:', error.message);
    res.status(500).json({ error: error.message });
  }
});
