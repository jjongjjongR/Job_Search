import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiClientService } from './ai-client.service';

describe('AiClientService', () => {
  let service: AiClientService;

  beforeEach(() => {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'ai.internalBaseUrl') {
          return 'http://127.0.0.1:8000';
        }
        if (key === 'ai.internalSharedSecret') {
          return 'replace-with-internal-secret';
        }
        throw new Error(`unexpected config key: ${key}`);
      }),
    } as unknown as ConfigService;

    service = new AiClientService(configService);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns parsed JSON when the internal API succeeds', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ companyName: 'OpenAI Korea' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(service.analyzeJob({ manualCompanyName: 'OpenAI Korea' })).resolves.toEqual({
      companyName: 'OpenAI Korea',
    });
  });

  it('maps 400 internal errors to BadRequestException and preserves detail payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: {
            errorCode: 'DOCUMENT_INSUFFICIENT',
            message: 'JD 또는 사용자 문서가 부족해 면접 세션을 시작할 수 없습니다.',
            retryable: false,
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(service.startInterview({} as never)).rejects.toMatchObject({
      constructor: BadRequestException,
      response: {
        errorCode: 'DOCUMENT_INSUFFICIENT',
        message: 'JD 또는 사용자 문서가 부족해 면접 세션을 시작할 수 없습니다.',
        retryable: false,
      },
    });
  });

  it('maps 404 internal errors to NotFoundException', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: {
            errorCode: 'NOT_FOUND',
            message: '공고 분석 결과를 찾을 수 없습니다.',
            retryable: false,
          },
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(service.createCoverLetterFeedback({})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps 500 internal errors to ServiceUnavailableException', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: {
            errorCode: 'AI_INTERNAL_UNAVAILABLE',
            message: '내부 AI 서버 처리 중 오류가 발생했습니다.',
            retryable: true,
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(service.finishInterview({} as never)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
