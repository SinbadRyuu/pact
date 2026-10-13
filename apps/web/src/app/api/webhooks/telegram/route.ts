import { NextResponse } from "next/server";

/**
 * Placeholder Telegram webhook endpoint.
 *
 * Not wired to any onboarding logic yet — we'll come back to this once the
 * bot exists and we've decided exactly what it's used for (currently
 * planned as: notifying admins when a new deposit screenshot needs review).
 *
 * Verifies Telegram's secret token (set via setWebhook's secret_token param)
 * so random requests to this URL can't trigger anything once this route
 * does real work.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const update = await request.json().catch(() => null);
  console.log("[webhooks/telegram] received update", update);

  // TODO: handle incoming Telegram updates once the bot's role is built out.
  return NextResponse.json({ ok: true });
}
