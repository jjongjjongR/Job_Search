// src/feedback/feedback.service.ts
import { Injectable } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';

export interface CoverLetterFeedback {
  summary: string;
  issues: string[];
  suggestions: string[];
}

@Injectable()
export class FeedbackService {
  constructor(private readonly openaiService: OpenAIService) {}

  async getCoverLetterFeedback(
    content: string,
  ): Promise<CoverLetterFeedback & { raw?: string }> {
    const prompt = `
너는 인사 담당자야.

내가 아래 자기소개서를 보낼 테니, 다음 세 가지 항목으로 평가해줘.
- summary: 자기소개서 전체에 대한 총평 (별점(5점만점)과 짧은 1~2문장)
- issues: 자기소개서의 문제점들 (항목별로 구체적이고 명확하게)
- suggestions: 개선을 위한 예시 문장들 (보다 나은 표현을 아주 구체적으로 직접 제안)

❗ 반드시 JSON만 출력해. 인삿말, 설명, 안내 문구 절대 금지.
❗ 출력은 반드시 { 로 시작해서 } 로 끝나는 JSON만 포함해야 해.

자기소개서:
"""
${content}
"""

반드시 아래 형식을 그대로 따를 것:

{
  "summary": "문장으로 된 총평을 여기에 작성",
  "issues": ["문제점1", "문제점2", "문제점3"],
  "suggestions": ["예시문장1", "예시문장2", "예시문장3"]
}
`.trim();

    const raw = await this.openaiService.analyzeComment(prompt);

    try {
      const jsonString = this.extractJsonFromText(raw);
      const parsed = JSON.parse(jsonString) as CoverLetterFeedback;

      return {
        summary: parsed.summary ?? '요약 없음',
        issues: parsed.issues ?? [],
        suggestions: parsed.suggestions ?? [],
      };
    } catch (err) {
      console.error('AI 응답 파싱 실패:', (err as Error).message);
      return {
        summary: 'AI 응답 파싱 실패',
        issues: [],
        suggestions: [],
        raw,
      };
    }
  }

  private extractJsonFromText(text: string): string {
    const match = text.match(/({[\s\S]*?})/); // lazy match, 줄바꿈 포함
    return match ? (match[1] ?? match[0]) : '{}';
  }
}
