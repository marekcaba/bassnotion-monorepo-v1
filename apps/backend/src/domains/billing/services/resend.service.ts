import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface FounderWelcomeInput {
  toEmail: string;
  firstName: string | null;
}

/**
 * Wraps the Resend SDK. One sender per environment (the From/Reply-To are
 * env-configurable so we can use a different identity later without a code
 * change). Stays narrow — only knows how to send the founder welcome.
 * If we need more templates, add discrete `sendX` methods rather than a
 * generic `send`.
 */
@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;
  private readonly replyToAddress: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required');
    }

    // Defaults match the founder welcome design — overridable via env so a
    // future welcome series can swap the identity without redeploying code.
    this.fromAddress =
      this.configService.get<string>('STRIPE_FOUNDER_EMAIL_FROM') ??
      'mar.c <mar.c@bassicology.com>';
    this.replyToAddress =
      this.configService.get<string>('STRIPE_FOUNDER_EMAIL_REPLY_TO') ??
      'mar.c@bassicology.com';

    this.resend = new Resend(apiKey);
  }

  /**
   * Send the founder welcome — dark-themed HTML matching the waitlist page,
   * with a plain-text fallback for clients that strip HTML (~5% of mail).
   * Returns the Resend message id on success for logging.
   *
   * HTML email constraints worth knowing:
   * - All styles MUST be inline (Gmail strips <style> tags).
   * - Use table-based layout for centering; flexbox isn't supported in
   *   Outlook 2016+.
   * - Bebas Neue isn't a web-safe font; we fall back to Impact / Arial Narrow.
   * - Background colors on <body> are often ignored; we paint the whole
   *   email area by giving the outer wrapper table the dark fill.
   */
  async sendFounderWelcome(input: FounderWelcomeInput): Promise<string | null> {
    const greeting = input.firstName ? `Hey ${input.firstName},` : 'Hey,';

    const text = buildPlainText(greeting);
    const html = buildHtml(greeting);

    try {
      const result = await this.resend.emails.send({
        from: this.fromAddress,
        to: input.toEmail,
        replyTo: this.replyToAddress,
        subject: "You're a Bassicology founder.",
        text,
        html,
      });

      if (result.error) {
        this.logger.error('Resend rejected founder welcome email', {
          to: input.toEmail,
          name: result.error.name,
          message: result.error.message,
        });
        return null;
      }

      const messageId = result.data?.id ?? null;
      this.logger.log(
        `Founder welcome sent → ${input.toEmail} (resend id ${messageId})`,
      );
      return messageId;
    } catch (err) {
      this.logger.error('Founder welcome send threw', {
        to: input.toEmail,
        err: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────
   Email body builders — kept as module-level pure functions to keep the
   class focused on Resend wiring. Replace these wholesale when LAUNCH-14
   introduces a real templates module (likely react-email).
   ────────────────────────────────────────────────────────────────────── */

function buildPlainText(greeting: string): string {
  return `${greeting}

Thank you. Genuinely.

You just put $397 into something that doesn't exist yet — on the promise of what it could be. That's not nothing. And I won't waste it.

You know why you clicked, even if you didn't say it out loud. You're done watching. You've watched the lessons, saved the tutorials, nodded along to the theory — and you still pick up the bass and feel like you're guessing. That's not a you problem. That's what happens when you spend years watching an instrument instead of playing it. Bassicology exists to end that. Bass in your hands from minute one, playing along to real music, hearing yourself get better. That's the whole thing. That's what these 100 seats are betting on.

Here's what's locked in for you:

- Lifetime access. You're one of the first 100. No monthly fee, ever.
- First through the door. Before any wave. Before any public launch.
- A real say in what gets built. That's not marketing — it's the entire reason I capped this at 100. A hundred people I can actually listen to beats ten thousand I can't.

What happens now: one update a month from me, between here and launch. Real progress — what's working, what broke, what changed. Not marketing. If something urgent shifts, you hear it first.

And one ask, if you're up for it. Hit reply and tell me what made you click "Become a founder." Was it the demo? The pitch? Or was it that feeling — the one where you've watched enough and you just want to play? Whatever it is, tell me. It shapes what I build next. I read every single reply.

Welcome to the Founding 100

— mar.c
Founder, Bassicology
bassicology.com

P.S. Your Stripe receipt is in a separate email. If anything looks off, reply here and I'll sort it personally.
`;
}

function buildHtml(greeting: string): string {
  // Brand palette — kept in sync with apps/frontend/src/app/page.tsx
  const PANEL = '#100E0D';
  const BORDER = '#26221E';
  const ORANGE = '#F26B1D';
  const TEXT = '#F5F1EB';
  const DIM = '#9A948C';
  const FAINT = '#6B655E';

  const HEADING_STACK =
    "'Bebas Neue', 'Oswald', 'Impact', 'Arial Narrow', sans-serif";
  const BODY_STACK =
    "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  // Perks rendered as a clean list with orange check markers.
  const perk = (bold: string, rest: string) => `
    <tr>
      <td style="padding: 8px 0; vertical-align: top;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right: 12px; vertical-align: top; line-height: 1.55; color: ${ORANGE}; font-family: ${BODY_STACK}; font-size: 15px; font-weight: 700;">
              ✓
            </td>
            <td style="vertical-align: top; line-height: 1.55; color: ${TEXT}; font-family: ${BODY_STACK}; font-size: 15px;">
              <strong style="color: ${TEXT}; font-weight: 600;">${bold}</strong> ${rest}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>You're a Bassicology founder.</title>
  </head>
  <body style="margin: 0; padding: 0; color: ${TEXT}; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;">
    <!-- Hidden preheader (preview text shown in inbox lists) -->
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; font-size: 1px; line-height: 1px; color: transparent;">
      Thank you. You just put $397 into something that doesn't exist yet — on the promise of what it could be.
    </div>

    <!-- Transparent outer wrapper: let the client's mail background show
         around the centered card so it pops in both light and dark modes. -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding: 32px 16px;">

          <!-- Inner 600px column -->
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">

            <!-- Card (contains everything — header through footer) -->
            <tr>
              <td style="background-color: ${PANEL}; border: 1px solid ${BORDER}; border-radius: 16px; padding: 32px 32px 36px;">

                <!-- Header: wordmark + chip, centered -->
                <p style="margin: 0 0 32px; text-align: center;">
                  <span style="font-family: ${HEADING_STACK}; text-transform: uppercase; font-size: 20px; letter-spacing: 0.14em; color: ${ORANGE}; vertical-align: middle;">BASSICOLOGY</span>
                  <span style="display: inline-block; margin-left: 12px; padding: 4px 12px; border: 1px solid ${BORDER}; border-radius: 999px; font-family: ${BODY_STACK}; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: ${DIM}; vertical-align: middle;">FOUNDER</span>
                </p>

                <!-- Headline -->
                <h1 style="margin: 0 0 28px; font-family: ${HEADING_STACK}; text-transform: uppercase; font-weight: 400; font-size: 30px; line-height: 1.0; letter-spacing: 0.01em; color: ${TEXT}; text-align: center; white-space: nowrap;">
                  You're a Bassicology <span style="color: ${ORANGE};">founder</span>
                </h1>

                <!-- Greeting + opening (merged so they read as one beat) -->
                <p style="margin: 0 0 18px; font-family: ${BODY_STACK}; font-size: 16px; line-height: 1.6; color: ${TEXT};">
                  ${greeting}<br />
                  Thank you. <strong style="color: ${TEXT}; font-weight: 600;">Genuinely.</strong>
                </p>

                <p style="margin: 0 0 18px; font-family: ${BODY_STACK}; font-size: 16px; line-height: 1.6; color: ${DIM};">
                  You just put <strong style="color: ${TEXT}; font-weight: 600;">$397</strong> into something that doesn't exist yet — on the promise of what it could be. That's not nothing. And I won't waste it.
                </p>

                <p style="margin: 0 0 28px; font-family: ${BODY_STACK}; font-size: 16px; line-height: 1.6; color: ${DIM};">
                  You know why you clicked, even if you didn't say it out loud. You're done watching. You've watched the lessons, saved the tutorials, nodded along to the theory — and you still pick up the bass and feel like you're guessing. <strong style="color: ${TEXT}; font-weight: 600;">That's not a you problem.</strong> That's what happens when you spend years watching an instrument instead of playing it. Bassicology exists to end that. Bass in your hands from minute one, playing along to real music, hearing yourself get better. That's the whole thing. That's what these 100 seats are betting on.
                </p>

                <!-- Perks -->
                <p style="margin: 0 0 16px; font-family: ${BODY_STACK}; font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${ORANGE};">
                  Here's what's locked in for you
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px;">
                  ${perk('Lifetime access.', "You're one of the first 100. No monthly fee, ever.")}
                  ${perk('First through the door —', 'before any wave. Before any public launch.')}
                  ${perk('A real say in what gets built.', "That's not marketing — it's the entire reason I capped this at 100. A hundred people I can actually listen to beats ten thousand I can't.")}
                </table>

                <p style="margin: 0 0 28px; font-family: ${BODY_STACK}; font-size: 16px; line-height: 1.6; color: ${DIM};">
                  <strong style="color: ${TEXT}; font-weight: 600;">What happens now:</strong> one update a month from me, between here and launch. Real progress — what's working, what broke, what changed. Not marketing. If something urgent shifts, you hear it first.
                </p>

                <!-- Soft CTA callout — not a button; the action IS reply -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px;">
                  <tr>
                    <td style="padding: 18px 20px; background-color: rgba(242, 107, 29, 0.08); border-left: 3px solid ${ORANGE}; border-radius: 4px;">
                      <p style="margin: 0; font-family: ${BODY_STACK}; font-size: 15px; line-height: 1.6; color: ${TEXT};">
                        <strong style="color: ${TEXT}; font-weight: 600;">One ask, if you're up for it.</strong> Hit reply and tell me what made you click "Become a founder." Was it the demo? The pitch? Or was it that feeling — the one where you've watched enough and you just want to play? Whatever it is, tell me. It shapes what I build next. I read every single reply.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Closing -->
                <p style="margin: 0 0 8px; font-family: ${HEADING_STACK}; text-transform: uppercase; font-size: 20px; letter-spacing: 0.02em; color: ${TEXT}; text-align: center;">
                  Welcome to the Founding 100
                </p>

                <p style="margin: 24px 0 4px; font-family: ${BODY_STACK}; font-size: 15px; line-height: 1.6; color: ${TEXT};">
                  — mar.c
                </p>
                <p style="margin: 0 0 4px; font-family: ${BODY_STACK}; font-size: 13px; line-height: 1.5; color: ${DIM};">
                  Founder, Bassicology
                </p>
                <p style="margin: 0; font-family: ${BODY_STACK}; font-size: 13px; line-height: 1.5;">
                  <a href="https://bassicology.com" style="color: ${ORANGE}; text-decoration: none;">bassicology.com</a>
                </p>

                <!-- P.S. divider -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 16px;">
                  <tr>
                    <td style="border-top: 1px solid ${BORDER}; height: 1px; line-height: 1px; font-size: 1px;">&nbsp;</td>
                  </tr>
                </table>

                <p style="margin: 0; font-family: ${BODY_STACK}; font-size: 13px; line-height: 1.6; color: ${FAINT};">
                  <strong style="color: ${DIM}; font-weight: 600;">P.S.</strong> Your Stripe receipt is in a separate email. If anything looks off, reply here and I'll sort it personally.
                </p>

              </td>
            </tr>

            <!-- Footer (sits outside the card, so the color must be readable
                 against both light and dark client backgrounds). -->
            <tr>
              <td style="padding: 24px 8px 8px; text-align: center; font-family: ${BODY_STACK}; font-size: 11px; letter-spacing: 0.08em; color: #8a847c;">
                Bassicology · Play, don't watch · 2026
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}
