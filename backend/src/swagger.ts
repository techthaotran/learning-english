import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJSDoc, { type OAS3Definition, type Options } from 'swagger-jsdoc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerDefinition: OAS3Definition = {
  openapi: '3.0.3',
  info: {
    title: 'Learning English API',
    version: '1.0.0',
    description: 'API documentation for Learning English backend.',
  },
  servers: [
    { url: 'http://localhost:4002', description: 'Local' },
    { url: '/', description: 'Same-origin (Vercel)' },
  ],
  tags: [
    { name: 'System', description: 'System endpoints' },
    { name: 'Dictionary', description: 'Dictionary endpoints' },
    { name: 'Participants', description: 'Participant endpoints' },
    { name: 'Translate', description: 'Translate endpoints' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                  },
                  required: ['ok'],
                },
              },
            },
          },
        },
      },
    },
  },
};

const swaggerOptions: Options = {
  definition: swaggerDefinition,
  apis: [path.join(__dirname, './routes/*.ts')],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);
