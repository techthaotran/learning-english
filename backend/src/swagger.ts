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
  apis: [
    path.join(__dirname, 'routes', '*.js'),
    path.join(__dirname, 'routes', '*.ts'),
  ],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);

const SWAGGER_UI_VERSION = '5.11.0';

/** HTML page — CDN assets work on Vercel (express.static / swagger-ui-express do not). */
export function renderSwaggerUiPage(specUrl: string): string {
  const css = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css`;
  const bundle = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js`;
  const preset = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-standalone-preset.js`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Learning English API</title>
  <link rel="stylesheet" href="${css}" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${bundle}" crossorigin></script>
  <script src="${preset}" crossorigin></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specUrl)},
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
      });
    };
  </script>
</body>
</html>`;
}
