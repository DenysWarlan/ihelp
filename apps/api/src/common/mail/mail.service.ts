import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { DEFAULT_MAIL_FROM } from './mail.const.js';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('SMTP_FROM',
      this.config.get<string>('MAIL_FROM', DEFAULT_MAIL_FROM));

    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn(
        'SMTP_HOST not configured — emails will be logged only',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.config.get<string>('SMTP_USER', ''),
        pass: this.config.get<string>('SMTP_PASS', ''),
      },
    });

    this.logger.log(`Mail transport configured: ${host}`);
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `[MAIL STUB] To: ${to} | Subject: ${subject}\n${html}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: "${subject}"`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error}`);
      throw error;
    }
  }

  /**
   * Send a staff invite email with a link to claim the invite.
   */
  async sendInvite(
    to: string,
    role: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:4333',
    );
    const claimUrl = `${frontendUrl}/staff/invite?token=${token}`;

    const subject = 'Запрошення до платформи «Є турбота»';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Вас запрошено на платформу «Є турбота»</h2>
        <p>Вам призначено роль: <strong>${role}</strong></p>
        <p>Щоб створити акаунт, натисніть кнопку нижче:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${claimUrl}"
             style="background-color: #4F46E5; color: #fff; padding: 12px 32px;
                    text-decoration: none; border-radius: 6px; font-size: 16px;">
            Прийняти запрошення
          </a>
        </div>
        <p style="color: #6B7280; font-size: 14px;">
          Посилання дійсне до ${expiresAt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.
        </p>
        <p style="color: #9CA3AF; font-size: 12px;">
          Якщо ви не очікували цього листа — проігноруйте його.
        </p>
      </div>
    `;

    await this.send(to, subject, html);
  }
}
