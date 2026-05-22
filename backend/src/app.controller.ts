import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return this.appService.getHello();
  }

  // 2026-05-18 신규: AWS ALB/ECS health check가 루트 경로에 의존하지 않도록 명시적 health endpoint 추가
  @Get('health')
  getExplicitHealth() {
    return { status: 'ok' };
  }
}
