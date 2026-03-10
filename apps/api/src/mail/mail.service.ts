import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('SMTP_FROM') || 'noreply@library.uskudar.edu.tr';
    this.frontendUrl = this.config.get<string>('CORS_ORIGIN') || 'http://localhost:3000';
  }

  async onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn(
        'SMTP_HOST not configured — emails will be logged to console instead of sent',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT') || '587'),
      secure: this.config.get<string>('SMTP_PORT') === '465',
      auth: {
        user: this.config.get<string>('SMTP_USER') || '',
        pass: this.config.get<string>('SMTP_PASS') || '',
      },
    });

    try {
      await this.transporter.verify();
      this.logger.log(`SMTP connected: ${host}`);
    } catch (err) {
      this.logger.error(`SMTP verification failed: ${err}. Falling back to console logging.`);
      this.transporter = null;
    }
  }

  /** True when a real SMTP transport is available */
  isConfigured(): boolean {
    return this.transporter !== null;
  }

  // ── Public email methods ───────────────────────────────────────

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    const subject = 'Verify your email — University Library';
    const html =
      `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">` +
      `<h2 style="color: #0D9488;">University Library</h2>` +
      `<p>Your verification code is:</p>` +
      `<div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; ` +
      `text-align: center; padding: 16px; background: #f3f4f6; border-radius: 8px; margin: 16px 0;">` +
      `${code}</div>` +
      `<p>This code expires in <strong>15 minutes</strong>.</p>` +
      `<p style="color: #6b7280; font-size: 13px;">If you didn't create an account, ignore this email.</p>` +
      `</div>`;

    await this.send(email, subject, html, `Your verification code is: ${code}`);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    const subject = 'Reset your password — University Library';
    const html =
      `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">` +
      `<h2 style="color: #0D9488;">University Library</h2>` +
      `<p>You requested a password reset. Click the button below:</p>` +
      `<div style="text-align: center; margin: 24px 0;">` +
      `<a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; ` +
      `background: #0D9488; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">` +
      `Reset Password</a></div>` +
      `<p style="font-size: 13px; color: #6b7280;">Or copy this link: ${resetUrl}</p>` +
      `<p>This link expires in <strong>1 hour</strong>.</p>` +
      `<p style="color: #6b7280; font-size: 13px;">If you didn't request this, ignore this email.</p>` +
      `</div>`;

    await this.send(email, subject, html, `Reset your password: ${resetUrl}`);
  }

  // ── Transport abstraction ──────────────────────────────────────

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logFallback(to, subject, text);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
        text,
      });
      this.logger.log(`Email sent to ${to}: "${subject}"`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err}`);
      // Fall back to console so the flow doesn't break
      this.logFallback(to, subject, text);
    }
  }

  private logFallback(to: string, subject: string, text: string): void {
    this.logger.warn(`[MAIL FALLBACK] To: ${to} | Subject: ${subject} | ${text}`);
  }
}
