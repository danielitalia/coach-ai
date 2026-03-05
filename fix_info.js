      res.json({
        instanceName,
        ownerJid: instance?.ownerJid || null,
        owner: instance?.ownerJid?.replace('@s.whatsapp.net', '') || null,
        profileName: instance?.profileName || null,
        profilePicUrl: instance?.profilePicUrl || null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
