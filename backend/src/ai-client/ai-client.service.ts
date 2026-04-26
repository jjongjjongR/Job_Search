import {
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
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
  // 2026-04-10 신규: 내부 AI 서버 타임아웃 시간을 한 곳에서 관리
  // 2026-04-11 수정: OpenAI 기반 공고 분석 응답 시간을 감안해 내부 AI 타임아웃을 확장
  private readonly requestTimeoutMs = 30000;
  // 2026-04-10 신규: 일시적 실패 시 한 번 더 시도하도록 재시도 횟수 추가
  private readonly retryCount = 1;

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
    // 2026-04-10 수정: FastAPI 실제 라우트 경로인 /answer 로 정정
    return this.post('/internal/interview/answer', payload);
  }

  async finishInterview(payload: FinishInterviewRequest) {
    return this.post('/internal/interview/finish', payload);
  }

  // 2026-04-10 신규: 공고 분석 내부 API 호출 메서드 추가
  async analyzeJob(payload: object) {
    return this.post('/internal/jobs/analyze', payload);
  }

  // 2026-04-10 신규: 자소서 피드백 내부 API 호출 메서드 추가
  async createCoverLetterFeedback(payload: object) {
    return this.post('/internal/cover-letter/feedback', payload);
  }

  private async post(path: string, payload: object) {
    // 2026-04-10 수정: timeout, retry, 에러 매핑을 공통 POST 로직에 모음
    for (let attempt = 0; attempt <= this.retryCount; attempt += 1) {
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-shared-secret': this.sharedSecret,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });

        if (!response.ok) {
          throw await this.mapInternalError(response);
        }

        return response.json();
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }

        if (error instanceof Error && error.name === 'TimeoutError') {
          if (attempt < this.retryCount) {
            continue;
          }

          throw new GatewayTimeoutException(
            '내부 AI 서버 응답 시간이 초과되었습니다.',
          );
        }

        if (attempt < this.retryCount) {
          continue;
        }

        throw new ServiceUnavailableException(
          '내부 AI 서버에 연결할 수 없습니다.',
        );
      }
    }
  }

  private async mapInternalError(response: Response): Promise<HttpException> {
    const errorBody = await response
      .json()
      .catch(() => ({ message: '내부 AI 서버 호출에 실패했습니다.' }));

    const detail =
      errorBody && typeof errorBody.detail === 'object' && errorBody.detail
        ? errorBody.detail
        : null;
    const message =
      typeof errorBody?.detail === 'string'
        ? errorBody.detail
        : typeof detail?.message === 'string'
          ? detail.message
          : typeof errorBody?.message === 'string'
            ? errorBody.message
            : '내부 AI 서버 호출에 실패했습니다.';

    if (response.status === 400 || response.status === 422) {
      throw new BadRequestException(
        detail ?? {
          errorCode: 'BAD_REQUEST',
          message,
          retryable: false,
          details: errorBody,
        },
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(
        detail ?? {
          errorCode: 'NOT_FOUND',
          message,
          retryable: false,
          details: errorBody,
        },
      );
    }

    if (response.status === 401) {
      throw new UnauthorizedException(
        detail ?? {
          errorCode: 'INTERNAL_AUTH_INVALID',
          message,
          retryable: false,
          details: errorBody,
        },
      );
    }

    if (response.status >= 500) {
      throw new ServiceUnavailableException(
        detail ?? {
          errorCode: 'AI_INTERNAL_UNAVAILABLE',
          message,
          retryable: true,
          details: errorBody,
        },
      );
    }

    throw new InternalServerErrorException(
      detail ?? {
        errorCode: 'AI_INTERNAL_ERROR',
        message,
        retryable: false,
        details: errorBody,
      },
    );
  }
}
