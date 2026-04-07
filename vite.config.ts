import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Serves /api/send-report and /api/translate locally during development.
function localApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      // POST /api/translate — proxy to OpenAI for on-demand translation
      server.middlewares.use(
        '/api/translate',
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
              const payload = JSON.parse(Buffer.concat(chunks).toString()) as {
                targetLang?: string;
                strings?: Record<string, string>;
              };
              const apiKey = env.OPENAI_API_KEY;
              if (!apiKey) { reply(500, { error: 'Translation service not configured.' }); return; }
              const { targetLang, strings } = payload;
              if (!targetLang || !strings) { reply(400, { error: 'targetLang and strings are required.' }); return; }
              const systemPrompt = [
                'You are a precise translator for an educational maths game called "Angle Explorer".',
                'Rules:',
                '1. Preserve all {placeholder} tokens exactly as-is (e.g. {count}, {level}, {email}).',
                '2. Do not translate URLs.',
                '3. Do not translate brand names: SeeMaths, Angle Explorer, Interactive Maths, DiscussIt.',
                '4. Keep angle type names in the target language mathematics convention.',
                '5. Return ONLY valid JSON: {"translations": {<key>: <translated_value>}, "langCode": "<ISO 639-1 code>"}',
              ].join('\n');
              const r = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  temperature: 0.3,
                  response_format: { type: 'json_object' },
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Translate the following JSON strings to ${targetLang}:\n${JSON.stringify(strings, null, 2)}` },
                  ],
                }),
              });
              if (!r.ok) { reply(502, { error: 'Translation failed.' }); return; }
              const data = await r.json() as { choices: Array<{ message: { content: string } }> };
              const parsed = JSON.parse(data.choices[0]?.message?.content ?? '{}') as {
                translations?: Record<string, string>;
                langCode?: string;
              };
              if (!parsed.translations || !parsed.langCode) { reply(502, { error: 'Invalid translation response.' }); return; }
              reply(200, { translations: parsed.translations, langCode: parsed.langCode });
            } catch (err) {
              console.error('[local-api/translate]', err);
              reply(500, { error: String(err) });
            }
          });
        },
      );

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
              const emailSubject = payload.emailSubject || `${gameName} Report`;
              const emailHtml = payload.emailHtml || `<p>Hi there,</p>
<p>A player played <strong>${gameName}</strong> at <a href="${siteUrl}">SeeMaths</a>
at <strong>${sessionTime}</strong> on <strong>${sessionDate}</strong> for
<strong>${durationText}</strong>. Score: <strong>${score}</strong>, accuracy: <strong>${accuracy}</strong>.</p>
<p>Topic: <a href="${currIndexUrl}">${stageLabel}</a> — <a href="${currUrl}">${currCode} ${currDesc}</a></p>
<p>Regards,<br/>${senderName}</p>`;
              const r = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: `${senderName} <${from}>`,
                  to: [email],
                  subject: emailSubject,
                  html: emailHtml,
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
