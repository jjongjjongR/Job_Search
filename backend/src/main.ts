// src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //CORS 활성화
  app.enableCors();

  // DTO 유효성 검사 활성화
  app.useGlobalPipes(new ValidationPipe());

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
