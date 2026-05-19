import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('SwaggerConfig');

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Bassicology API')
    .setDescription('The Bassicology API documentation for learning bass guitar')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('exercises', 'Exercise management')
    .addTag('tutorials', 'Tutorial content')
    .addTag('youtube', 'YouTube integration')
    .addTag('creators', 'Content creator management')
    .addTag('health', 'Health check endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token from login response',
      },
      'access-token',
    )
    .addServer('http://localhost:3000', 'Local development')
    .addServer('https://api.bassnotion.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  try {
    // Setup NestJS Swagger - should work with Fastify in newer versions
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'Bassicology API Documentation',
    });
    logger.info(
      '✅ Swagger documentation available at: http://localhost:3000/api/docs',
    );
  } catch (error) {
    logger.error('❌ Failed to setup Swagger UI:', error as Error, {});
  }

  // Serve the OpenAPI JSON spec
  try {
    const fastifyApp = app as NestFastifyApplication;
    const fastifyInstance = fastifyApp.getHttpAdapter().getInstance();

    fastifyInstance.get('/api/openapi.json', async (request, reply) => {
      return reply.type('application/json').send(document);
    });

    logger.info(
      '✅ OpenAPI spec available at: http://localhost:3000/api/openapi.json',
    );
  } catch (error) {
    logger.error(
      '❌ Failed to setup OpenAPI JSON endpoint:',
      error as Error,
      {},
    );
  }
}
