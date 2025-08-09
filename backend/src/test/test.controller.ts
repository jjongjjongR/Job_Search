// src/test/test.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('test')
export class TestController {
  @Get('env')
  getEnvKey() {
    const key = process.env.OPENAI_API_KEY;
    console.log('OPENAI_API_KEY:', key);
    return { OPENAI_API_KEY: key ?? '없음' };
  }
}
