    import { exec } from 'child_process';
    import qrcode from 'qrcode-terminal';
    import pico from 'picocolors';
    import gradient from 'gradient-string';
    import Table from 'cli-table3';
    import readline from 'readline';
    import { readdirSync, existsSync } from 'fs';
    import { join } from 'path';

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    let activeUrls = [];
    let templates = [];
    let spinnerInterval;
    let spinnerFrame = 0;

    const SPINNER = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];

    const TUNNELS = [
      {
        key: 'localtunnel',
        name: 'LocalTunnel',
        cmd: p => `npx localtunnel --port ${p}`,
        regex: /https?:\/\/[a-z0-9-]+\.loca\.lt/
      },
      {
        key: 'cloudflared',
        name: 'Cloudflare',
        cmd: p => `npx cloudflared tunnel --url http://localhost:${p}`,
        regex: /https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.trycloudflare\.com/
      }
    ];

    function clear() {
      process.stdout.write('\x1Bc');
    }

    function header() {
      console.log(
        gradient.retro(`
    ██████╗ ██╗  ██╗ █████╗ ███╗   ██╗████████╗ ██████╗ ███╗   ███╗
    ██╔══██╗██║  ██║██╔══██╗████╗  ██║╚══██╔══╝██╔═══██╗████╗ ████║
    ██████╔╝███████║███████║██╔██╗ ██║   ██║   ██║   ██║██╔████╔██║
    ██╔═══╝ ██╔══██║██╔══██║██║╚██╗██║   ██║   ██║   ██║██║╚██╔╝██║
    ██║     ██║  ██║██║  ██║██║ ╚████║   ██║   ╚██████╔╝██║ ╚═╝ ██║
    ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚═╝         `
        )
      );
      console.log(pico.gray('                 PhantomLink • Secure Share Engine\n'));
    }

    function divider(label = '') {
      console.log(pico.gray(` ────────── ${label} ──────────`));
    }

    function startSpinner() {
      spinnerInterval = setInterval(() => {
        process.stdout.write(
          `\r ${pico.cyan(SPINNER[spinnerFrame])} ${pico.gray('Establishing secure tunnels...')}`
        );
        spinnerFrame = (spinnerFrame + 1) % SPINNER.length;
      }, 80);
    }

    function stopSpinner() {
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
      }
      process.stdout.write('\r\x1b[K');
    }

    function extractUrl(line, tunnel, showQR, expectedCount) {
      const match = line.match(tunnel.regex);
      if (!match) return;

      const url = match[0];
      if (activeUrls.includes(url)) return;

      activeUrls.push(url);
      stopSpinner();

      console.log(
        pico.green(`\n ✔ ${tunnel.name} connected`) +
        pico.gray(`  →  ${url}`)
      );

      if (showQR) qrcode.generate(url, { small: true });
      if (activeUrls.length < expectedCount) {
        startSpinner();
      }
    }

    export function startTunnels(port, config = {}) {
      const enabled = config.tunnels?.enabled || ['localtunnel', 'cloudflared'];
      const showQR = config.notifications?.qrInTerminal !== false;
      const expectedCount = enabled.length; 

      clear();
      header();
      divider('BOOT');
      console.log(pico.gray(` Port: ${port}`));
      console.log(pico.gray(` Tunnels: ${enabled.join(', ')}`));
      divider('STATUS');

      startSpinner();
      activeUrls = [];

      enabled.forEach(key => {
        const t = TUNNELS.find(x => x.key === key);
        if (!t) return;

        const child = exec(t.cmd(port));
        let buffer = '';

        child.stdout.on('data', d => {
          buffer += d.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          lines.forEach(l => extractUrl(l.trim(), t, showQR, expectedCount));
        });

        child.stderr.on('data', d =>
          extractUrl(d.toString().trim(), t, showQR, expectedCount)
        );
      });

      setTimeout(() => {
        stopSpinner();
        divider('READY');

        activeUrls.unshift(`http://localhost:${port}`);
        console.log(pico.green(` ${activeUrls.length - 1} tunnel(s) online\n`));
        loadTemplatesAndShowMenu();
      }, 6000);
    }

    function loadTemplatesAndShowMenu() {
      const dir = join(process.cwd(), 'templates');
      if (!existsSync(dir)) return;

      templates = readdirSync(dir)
        .filter(d => existsSync(join(dir, d, 'index.html')))
        .sort();

      divider('TEMPLATES');

      const table = new Table({
        head: ['ID', 'Template'],
        colWidths: [6, 40]
      });

      templates.forEach((t, i) => table.push([i + 1, t]));
      console.log(table.toString());

      rl.question(pico.cyan('\n Select: '), a => {
        const i = parseInt(a) - 1;
        if (!templates[i]) return loadTemplatesAndShowMenu();
        showTunnelTable(templates[i]);
      });
    }

    function showTunnelTable(template) {
      divider(`DEPLOY • ${template}`);

      const table = new Table({
        head: ['ID', 'Tunnel'],
        colWidths: [6, 50]
      });

      activeUrls.forEach((u, i) => {
        const name =
          u.includes('localhost') ? 'Localhost' :
          u.includes('loca.lt') ? 'LocalTunnel' :
          'Cloudflare';
        table.push([i + 1, name]);
      });

      console.log(table.toString());

      rl.question(pico.cyan('\n Select: '), a => {
        const i = parseInt(a) - 1;
        if (!activeUrls[i]) return showTunnelTable(template);
        showFinalLink(activeUrls[i], template);
      });
    }

    function showFinalLink(url, template) {
      const link = `${url}/${template}`;

      divider('FINAL LINK');
      console.log(gradient.fruit(` ${link}\n`));
      qrcode.generate(link, { small: false });

      console.log(pico.green('\n ✔ Ready to share\n'));
      rl.close();
    }