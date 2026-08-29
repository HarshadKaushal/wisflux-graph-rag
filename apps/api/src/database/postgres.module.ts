import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { PostgresConfig } from '../config/configuration';
import { DocumentEntity } from '../documents/entities/document.entity';
import { ChunkEntity } from '../documents/entities/chunk.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const pg = config.get<PostgresConfig>('postgres')!;
        return {
          type: 'postgres' as const,
          host: pg.host,
          port: pg.port,
          username: pg.user,
          password: pg.password,
          database: pg.database,
          entities: [DocumentEntity, ChunkEntity],
          // Keep false: synchronize drops the pgvector `embedding` column
          // (managed by DatabaseInitService, not the TypeORM entity).
          synchronize: false,
          logging: config.get<string>('app.nodeEnv') === 'development',
        };
      },
    }),
    TypeOrmModule.forFeature([DocumentEntity, ChunkEntity]),
  ],
  exports: [TypeOrmModule],
})
export class PostgresModule {}
