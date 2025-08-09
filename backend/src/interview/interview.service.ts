import { Injectable } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';
import { OpenAIMessage, InterviewAIResponse } from './interview.types';

@Injectable()
export class InterviewService {
  constructor(private readonly openaiService: OpenAIService) {}

  async generateNext(history: OpenAIMessage[]): Promise<InterviewAIResponse> {
    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: `
            너는 매우 유능한 인사담당자야. 사용자의 대답을 바탕으로 면접을 진행하고, 간단한 피드백을 제공해.

            ❗❗ 반드시 다음 형식으로만 응답해야 해. 이외 어떤 문장도 덧붙이지 마.

            {
                "reply": "면접 질문 혹은 응답",
                "feedback": "있으면 피드백, 없으면 null"
            }

            예시 1:
            { "reply": "자기소개 부탁드립니다.", "feedback": null }

            예시 2:
            { "reply": "왜 이 회사에 지원하셨나요?", "feedback": "이전 답변은 너무 짧았고 구체적인 사례가 부족했어요." }

            반드시 JSON만 반환해야 해. 한국어로 대답해.
        `.trim(),
      },
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    const response = await this.openaiService.chat(messages);
    const extractedJson = this.extractJson(response.content);

    console.log('🧪 GPT 원본 응답:', response.content);

    const parsed = safeParseJson(extractedJson);
    if (isValidInterviewAIResponse(parsed)) {
      const reply = parsed.reply;
      const feedback = parsed.feedback;
      return { reply, feedback };
    }

    return {
      reply: '죄송합니다. 응답을 이해하지 못했습니다.',
      feedback: null,
    };
  }

  private extractJson(text: string): string {
    const match = text.match(/({[\s\S]*})/);
    return match ? match[1] : '{}';
  }
}

// ✅ 안전한 JSON 파서
function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// ✅ 타입 가드
function isValidInterviewAIResponse(obj: unknown): obj is InterviewAIResponse {
  if (
    typeof obj === 'object' &&
    obj !== null &&
    'reply' in obj &&
    typeof (obj as Record<string, unknown>).reply === 'string' &&
    'feedback' in obj &&
    (typeof (obj as Record<string, unknown>).feedback === 'string' ||
      (obj as Record<string, unknown>).feedback === null)
  ) {
    return true;
  }
  return false;
}
