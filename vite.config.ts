import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Serves the /api/send-report endpoint locally using the same Resend call
// as the Vercel function (api/send-report.ts), reading RESEND_API_KEY and
// EMAIL_FROM from .env.local via Vite's loadEnv.
function localApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(
        '/api/send-report',
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method !== 'POST') { next(); return; }
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', async () => {
            const reply = (status: number, body: unknown) => {
              res.writeHead(status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(body));
            };
            try {
              const payload = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, string>;
              const apiKey = env.RESEND_API_KEY;
              const from   = env.EMAIL_FROM;
              if (!apiKey || !from) { reply(500, { error: 'Email service not configured.' }); return; }
              const email = (payload.email ?? '').trim();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { reply(400, { error: 'Invalid email.' }); return; }
              const pdfBase64 = payload.pdfBase64 ?? '';
              if (!pdfBase64) { reply(400, { error: 'Report attachment missing.' }); return; }
              const senderName   = payload.senderName   || 'Angle Explorer';
              const gameName     = payload.gameName     || 'Angle Explorer';
              const siteUrl      = payload.siteUrl      || 'https://www.seemaths.com';
              const reportFile   = payload.reportFileName || 'angle-report.pdf';
              const score        = `${payload.correctCount ?? 0}/${payload.totalQuestions ?? 0}`;
              const accuracy     = `${payload.accuracy ?? 0}%`;
              const sessionTime  = payload.sessionTime  || '';
              const sessionDate  = payload.sessionDate  || '';
              const durationText = payload.durationText || '';
              const stageLabel   = payload.stageLabel   || 'NSW Curriculum';
              const currCode     = payload.curriculumCode || 'N/A';
              const currDesc     = payload.curriculumDescription || '';
              const currUrl      = payload.curriculumUrl || siteUrl;
              const currIndexUrl = payload.curriculumIndexUrl || siteUrl;
              const r = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: `${senderName} <${from}>`,
                  to: [email],
                  subject: `${gameName} Report`,
                  html: `<p>Hi there,</p>
<p>A player played <strong>${gameName}</strong> at <a href="${siteUrl}">SeeMaths</a>
at <strong>${sessionTime}</strong> on <strong>${sessionDate}</strong> for
<strong>${durationText}</strong>. Score: <strong>${score}</strong>, accuracy: <strong>${accuracy}</strong>.</p>
<p>Topic: <a href="${currIndexUrl}">${stageLabel}</a> — <a href="${currUrl}">${currCode} ${currDesc}</a></p>
<p>Regards,<br/>${senderName}</p>`,
                  attachments: [{ filename: reportFile, content: pdfBase64 }],
                }),
              });
              if (!r.ok) {
                const err = await r.text();
                console.error('[local-api] Resend error:', err);
                reply(502, { error: 'Email send failed.' });
                return;
              }
              reply(200, { ok: true });
            } catch (err) {
              console.error('[local-api] Error:', err);
              reply(500, { error: String(err) });
            }
          });
        },
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // load ALL .env vars (no VITE_ prefix filter)
  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      localApiPlugin(env),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\//,
              handler: 'NetworkFirst',
              options: { cacheName: 'external-cache', networkTimeoutSeconds: 10 },
            },
          ],
        },
      }),
    ],
    server: {
      port: 4002,
      strictPort: true,
    },
  }
})
