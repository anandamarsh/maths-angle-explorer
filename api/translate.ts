// api/translate.ts — Vercel serverless: on-demand OpenAI translation

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Translation service not configured." });
    return;
  }

  const { targetLang, strings } = req.body as {
    targetLang?: string;
    strings?: Record<string, string>;
  };

  if (!targetLang || !strings || typeof strings !== "object") {
    res.status(400).json({ error: "targetLang and strings are required." });
    return;
  }

  const systemPrompt = [
    `You are a precise translator for an educational maths game called "Angle Explorer".`,
    `Rules:`,
    `1. Preserve all {placeholder} tokens exactly as-is (e.g. {count}, {level}, {email}).`,
    `2. Do not translate URLs.`,
    `3. Do not translate brand names: SeeMaths, Angle Explorer, Interactive Maths, DiscussIt.`,
    `4. Keep angle type names (ACUTE, OBTUSE, REFLEX, etc.) in the target language convention — translate them if the target language has standard mathematics terms, otherwise keep them.`,
    `5. Return ONLY valid JSON: {"translations": {<key>: <translated_value>}, "langCode": "<ISO 639-1 code>"}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Translate the following JSON strings to ${targetLang}:\n${JSON.stringify(strings, null, 2)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[translate] OpenAI error:", errText);
      res.status(502).json({ error: "Translation failed." });
      return;
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as {
      translations?: Record<string, string>;
      langCode?: string;
    };

    if (!parsed.translations || !parsed.langCode) {
      console.error("[translate] Unexpected response shape:", content);
      res.status(502).json({ error: "Invalid translation response." });
      return;
    }

    res.status(200).json({ translations: parsed.translations, langCode: parsed.langCode });
  } catch (err) {
    console.error("[translate] Error:", err);
    res.status(500).json({ error: String(err) });
  }
}
