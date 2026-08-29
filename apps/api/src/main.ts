import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

/** Load monorepo-root .env before Nest bootstrap (pnpm runs from apps/api). */
function loadEnvironment(): void {
  const candidates = [
    resolve(__dirname, '../../..', '.env'),
    resolve(__dirname, '../..', '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      loadEnv({ path: envPath, override: true });
      return;
    }
  }
}

function ensureUploadDir(uploadDir: string): void {
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
}

loadEnvironment();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app')!;
  ensureUploadDir(appConfig.uploadDir);

  app.setGlobalPrefix(appConfig.apiPrefix);
  app.enableCors({
    origin: ['http://localhost:3000'],
    credentials: true,
  });

  await app.listen(appConfig.port);
  console.log(
    `API running at http://localhost:${appConfig.port}/${appConfig.apiPrefix}`,
  );
}

bootstrap();
