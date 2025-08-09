// src/openai/openai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI | null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY 가 설정되지 않았습니다.');
      this.openai = null;
    } else {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async analyzeComment(prompt: string): Promise<string> {
    if (!this.openai) {
      return 'API 키 누락으로 분석할 수 없습니다.';
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o', // 안정적인 JSON 응답을 위한 최신 모델
        messages: [
          {
            role: 'system',
            content: '너는 자기소개서를 평가해주는 AI 도우미야.',
          },
          { role: 'user', content: prompt },
        ],
      });

      return response.choices[0]?.message?.content ?? '결과 없음';
    } catch (error) {
      this.logger.error('OpenAI 요청 실패:', error);
      return 'AI 응답 실패';
    }
  }

  // src/openai/openai.service.ts
  async chat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  ) {
    if (!this.openai) {
      return { content: 'OpenAI API 키가 없습니다.' };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
      });

      return {
        content: response.choices[0]?.message?.content ?? '결과 없음',
      };
    } catch (error) {
      this.logger.error('OpenAI Chat 실패:', error);
      return { content: 'AI 응답 실패' };
    }
  }
}
