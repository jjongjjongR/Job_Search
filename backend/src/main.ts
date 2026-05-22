import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// 2026-05-18 신규: AWS/로컬 환경별 CORS origin을 쉼표 구분 환경변수로 처리
function buildAllowedOrigins() {
  return (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    // 2026-05-18 수정: Amplify/custom domain 등 여러 frontend origin을 허용할 수 있게 변경
    origin: buildAllowedOrigins(),
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'X-File-Name'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('World Job Search API')
    .setDescription('1차 범위용 인증 뼈대 API 문서')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
