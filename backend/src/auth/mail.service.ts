import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  assertEmailVerificationReady() {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      throw new ServiceUnavailableException(
        '이메일 발송 설정이 완료되지 않았습니다.',
      );
    }
  }

  async sendEmailVerification(email: string, verificationUrl: string) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from =
      this.configService.get<string>('MAIL_FROM') ??
      `World Job Search <${user ?? ''}>`;

    this.assertEmailVerificationReady();

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: '[World Job Search] 이메일 인증을 완료해 주세요',
        text: [
          'World Job Search 회원가입 이메일 인증 안내입니다.',
          '',
          '아래 링크를 열어 이메일 인증을 완료해 주세요.',
          verificationUrl,
          '',
          '이 링크는 30분 동안 사용할 수 있습니다.',
        ].join('\n'),
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17202a">
            <h2>World Job Search 이메일 인증</h2>
            <p>아래 버튼을 눌러 이메일 인증을 완료해 주세요.</p>
            <p>
              <a href="${verificationUrl}" style="display:inline-block;padding:12px 18px;background:#246bca;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">
                이메일 인증하기
              </a>
            </p>
            <p style="color:#66717f;font-size:13px">링크는 30분 동안 사용할 수 있습니다.</p>
          </div>
        `,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '알 수 없는 SMTP 오류';
      this.logger.error(`Email verification send failed: ${message}`);
      throw new ServiceUnavailableException(
        `인증 메일 발송에 실패했습니다. SMTP 설정을 확인해 주세요. (${message})`,
      );
    }
  }
}
