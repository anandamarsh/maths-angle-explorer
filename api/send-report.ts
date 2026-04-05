export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeBody(body: unknown) {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body && typeof body === "object" ? body : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    res.status(500).json({ error: "Email service is not configured." });
    return;
  }

  const payload = normalizeBody(req.body) as
    | {
        email?: string;
        pdfBase64?: string;
        playerName?: string;
        correctCount?: number;
        totalQuestions?: number;
        accuracy?: number;
        totalEggs?: number;
        reportFileName?: string;
      }
    | null;

  const email = payload?.email?.trim() ?? "";
  const pdfBase64 = payload?.pdfBase64?.trim() ?? "";

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  if (!pdfBase64) {
    res.status(400).json({ error: "Report attachment is missing." });
    return;
  }

  const playerName = (payload?.playerName || "Explorer").trim() || "Explorer";
  const reportFileName = payload?.reportFileName || "angle-report.pdf";
  const scoreLine = `${payload?.correctCount ?? 0}/${payload?.totalQuestions ?? 0}`;
  const accuracy = `${payload?.accuracy ?? 0}%`;
  const eggs = `${payload?.totalEggs ?? 0}`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${playerName}'s Angle Explorer Report`,
      html: `
        <p>Hi,</p>
        <p>The latest Angle Explorer session report is attached.</p>
        <ul>
          <li><strong>Player:</strong> ${escapeHtml(playerName)}</li>
          <li><strong>Score:</strong> ${escapeHtml(scoreLine)}</li>
          <li><strong>Accuracy:</strong> ${escapeHtml(accuracy)}</li>
          <li><strong>Eggs Collected:</strong> ${escapeHtml(eggs)}</li>
        </ul>
      `,
      attachments: [
        {
          filename: reportFileName,
          content: pdfBase64,
        },
      ],
    }),
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    console.error("Resend send failed:", errorText);
    res.status(502).json({ error: "Report email could not be sent." });
    return;
  }

  res.status(200).json({ ok: true });
}
