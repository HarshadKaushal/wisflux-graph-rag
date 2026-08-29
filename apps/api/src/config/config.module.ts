import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  appConfig,
  neo4jConfig,
  openAiConfig,
  postgresConfig,
} from './configuration';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    ConfigModule.forFeature(appConfig),
    ConfigModule.forFeature(postgresConfig),
    ConfigModule.forFeature(neo4jConfig),
    ConfigModule.forFeature(openAiConfig),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}

export { validateEnv };
