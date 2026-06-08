import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

export type MailSendParams = {
  userId: string;
  to: string;
  subject: string;
  text: string;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;
  private smtpTransport: nodemailer.Transporter | null = null;

  onModuleInit() {
    this.initProviders();
  }

  private initProviders() {
    if (!this.isEnabled()) return;

    const provider = this.getProvider();
    if (provider === 'resend') {
      const key = process.env.RESEND_API_KEY?.trim();
      if (!key) {
        this.logger.warn('MAIL_ENABLED=true but RESEND_API_KEY missing');
        return;
      }
      this.resend = new Resend(key);
      const override = process.env.MAIL_OVERRIDE_TO?.trim();
      if (override) {
        this.logger.log(
          `Resend ready; MAIL_OVERRIDE_TO active (all mail → ${this.maskEmail(override)})`,
        );
      } else {
        this.logger.log(
          'Resend ready. Without a verified domain, Resend only delivers to your account email — set MAIL_OVERRIDE_TO in .env for local testing.',
        );
      }
    } else if (provider === 'smtp') {
      const host = process.env.SMTP_HOST?.trim();
      const port = Number(process.env.SMTP_PORT ?? 587);
      const user = process.env.SMTP_USER?.trim();
      const pass = process.env.SMTP_PASS?.trim();
      if (!host || !user || !pass) {
        this.logger.warn('MAIL_ENABLED=true but SMTP_* vars incomplete');
        return;
      }
      this.smtpTransport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: { user, pass },
      });
    }

    const from = process.env.EMAIL_FROM?.trim();
    if ((provider === 'resend' || provider === 'smtp') && !from) {
      this.logger.warn('MAIL_ENABLED=true but EMAIL_FROM missing');
    }
  }

  isEnabled(): boolean {
    const v = process.env.MAIL_ENABLED?.toLowerCase();
    return v === 'true' || v === '1';
  }

  getProvider(): 'resend' | 'smtp' | 'log' {
    const p = (process.env.MAIL_PROVIDER ?? 'log').toLowerCase();
    if (p === 'resend' || p === 'smtp') return p;
    return 'log';
  }

  private resolveRecipient(intendedTo: string): {
    to: string;
    textSuffix: string;
  } {
    const override = process.env.MAIL_OVERRIDE_TO?.trim();
    if (override && override !== intendedTo) {
      return {
        to: override,
        textSuffix: `\n\n[פיתוח: מייל מיועד ל-${intendedTo}]`,
      };
    }
    return { to: intendedTo, textSuffix: '' };
  }

  /** @returns true if send succeeded (or log provider recorded intent) */
  async send(params: MailSendParams): Promise<boolean> {
    if (!this.isEnabled()) {
      this.logger.debug('Mail skipped: MAIL_ENABLED is not true');
      return false;
    }

    const provider = this.getProvider();
    const from = process.env.EMAIL_FROM?.trim() ?? 'noreply@scholarpath.local';
    const { to, textSuffix } = this.resolveRecipient(params.to);
    const body = params.text + textSuffix;

    if (provider === 'log') {
      this.logger.log(
        `Email (log): userId=${params.userId} to=${this.maskEmail(to)} subject=${params.subject}`,
      );
      return true;
    }

    if (provider === 'resend') {
      if (!this.resend) {
        this.initProviders();
      }
      if (!this.resend) {
        this.logger.warn(
          'Resend client not initialized — check RESEND_API_KEY and restart API',
        );
        return false;
      }
      const { data, error } = await this.resend.emails.send({
        from,
        to,
        subject: params.subject,
        text: body,
      });
      if (error) {
        const hint = error.message.includes('only send testing emails')
          ? ' Resend sandbox: verify a domain at resend.com/domains, or use MAIL_PROVIDER=smtp for dev.'
          : '';
        this.logger.warn(
          `Resend failed (to=${this.maskEmail(to)}): ${error.message}${hint}`,
        );
        return false;
      }
      this.logger.log(
        `Resend sent id=${data?.id ?? 'unknown'} to=${this.maskEmail(to)}`,
      );
      return true;
    }

    if (!this.smtpTransport) {
      this.initProviders();
    }
    if (!this.smtpTransport) return false;
    try {
      await this.smtpTransport.sendMail({
        from,
        to,
        subject: params.subject,
        text: body,
      });
      this.logger.log(`SMTP sent to=${this.maskEmail(to)}`);
      return true;
    } catch (err) {
      this.logger.warn(
        `SMTP failed: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const masked =
      local.length <= 2 ? '**' : `${local[0]}***${local[local.length - 1]}`;
    return `${masked}@${domain}`;
  }
}
