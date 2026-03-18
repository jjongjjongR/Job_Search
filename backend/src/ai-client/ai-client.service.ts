import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FinishInterviewRequest,
  ProcessInterviewAnswerRequest,
  StartInterviewRequest,
} from './interfaces/interview-request.interface';

@Injectable()
export class AiClientService {
  private readonly baseUrl: string;
  private readonly sharedSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.getOrThrow<string>('ai.internalBaseUrl');
    this.sharedSecret = this.configService.getOrThrow<string>(
      'ai.internalSharedSecret',
    );
  }

  async startInterview(payload: StartInterviewRequest) {
    return this.post('/internal/interview/start', payload);
  }

  async processInterviewAnswer(payload: ProcessInterviewAnswerRequest) {
    return this.post('/internal/interview/process-answer', payload);
  }

  async finishInterview(payload: FinishInterviewRequest) {
    return this.post('/internal/interview/finish', payload);
  }

  private async post(path: string, payload: object) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-shared-secret': this.sharedSecret,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        '내부 AI 서버 호출에 실패했습니다.',
      );
    }

    return response.json();
  }
}
