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
   * Send the founder welcome email. Plain-text only — the email is designed
   * to read like a personal note from the founder, and HTML would undercut
   * the tone. Returns the Resend message id on success for logging.
   */
  async sendFounderWelcome(input: FounderWelcomeInput): Promise<string | null> {
    const greeting = input.firstName ? `Hey ${input.firstName},` : 'Hey,';

    const body = `${greeting}

Thank you. Genuinely.

You just put $397 into something that doesn't exist yet — on the promise of what it could be. That's not nothing. And I won't waste it.

You know why you clicked, even if you didn't say it out loud. You're done watching. You've watched the lessons, saved the tutorials, nodded along to the theory — and you still pick up the bass and feel like you're guessing. That's not a you problem. That's what happens when you spend years watching an instrument instead of playing it. Bassicology exists to end that. Bass in your hands from minute one, playing along to real music, hearing yourself get better. That's the whole thing. That's what these 100 seats are betting on.

Here's what's locked in for you:

- Lifetime access. You're one of the first 100. No monthly fee, ever.
- First through the door. Before any wave. Before any public launch.
- A real say in what gets built. That's not marketing — it's the entire reason I capped this at 100. A hundred people I can actually listen to beats ten thousand I can't.

What happens now: one update a month from me, between here and launch. Real progress — what's working, what broke, what changed. Not marketing. If something urgent shifts, you hear it first.

And one ask, if you're up for it. Hit reply and tell me what made you click "Become a founder." Was it the demo? The pitch? Or was it that feeling — the one where you've watched enough and you just want to play? Whatever it is, tell me. It shapes what I build next. I read every single reply.

Welcome to the Founding 100.

— Marek
Founder, Bassicology
bassicology.com

P.S. Your Stripe receipt is in a separate email. If anything looks off, reply here and I'll sort it personally.
`;

    try {
      const result = await this.resend.emails.send({
        from: this.fromAddress,
        to: input.toEmail,
        replyTo: this.replyToAddress,
        subject: "You're a Bassicology founder.",
        text: body,
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
