import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsNumber()
  @Min(1)
  API_PORT?: number;

  @IsOptional()
  @IsString()
  API_PREFIX?: string;

  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsString()
  POSTGRES_HOST!: string;

  @IsOptional()
  @IsNumber()
  POSTGRES_PORT?: number;

  @IsString()
  POSTGRES_USER!: string;

  @IsString()
  POSTGRES_PASSWORD!: string;

  @IsString()
  POSTGRES_DB!: string;

  @IsString()
  NEO4J_URI!: string;

  @IsString()
  NEO4J_USER!: string;

  @IsString()
  NEO4J_PASSWORD!: string;

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  UPLOAD_DIR?: string;

  @IsOptional()
  @IsNumber()
  MAX_UPLOAD_SIZE_MB?: number;
}

export function validateEnv(config: Record<string, unknown>) {
  const withDefaults = {
    POSTGRES_HOST: 'localhost',
    POSTGRES_PORT: 5432,
    POSTGRES_USER: 'graphrag',
    POSTGRES_PASSWORD: 'graphrag',
    POSTGRES_DB: 'graphrag',
    NEO4J_URI: 'bolt://localhost:7687',
    NEO4J_USER: 'neo4j',
    NEO4J_PASSWORD: 'graphrag123',
    ...config,
  };

  const validated = plainToInstance(EnvironmentVariables, withDefaults, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .flatMap((e) => Object.values(e.constraints ?? {}))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validated;
}
