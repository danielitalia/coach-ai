// WhatsApp QR code alias
app.get('/api/whatsapp/qrcode', legacyTenant, async (req, res) => {
    try {
        const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';
        console.log('[QR-DEBUG] Richiesta QR per: ' + instanceName);

        // Tentativo di recupero QR (o creazione se fallisce)
        let qrcode = null;
        try {
            const connectResponse = await axios.get(
                'http://evolution-api:8080/instance/connect/' + instanceName,
                { headers: { 'apikey': '065aa73d6bbdeaa4a9a0c7b94a8db194' } }
            );
            qrcode = connectResponse.data?.qrcode?.base64 || connectResponse.data?.base64;
        } catch (e) {
            console.log('[QR-DEBUG] Istanza ' + instanceName + ' non pronta, provo a crearla...');
            await axios.post(
                'http://evolution-api:8080/instance/create',
                { instanceName: instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true },
                { headers: { 'apikey': '065aa73d6bbdeaa4a9a0c7b94a8db194' } }
            ).catch(() => null);

            await new Promise(r => setTimeout(r, 4000));
            const qrResponse = await axios.get(
                'http://evolution-api:8080/instance/connect/' + instanceName,
                { headers: { 'apikey': '065aa73d6bbdeaa4a9a0c7b94a8db194' } }
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
