import './loadEnv.js';
import express from 'express';
import cors, { type CorsOptions } from 'cors';
import dictionaryRouter from './routes/dictionary.js';
import participantsRouter from './routes/participants.js';
import translateRouter from './routes/translate.js';
import { initDb } from './db.js';
import { renderSwaggerUiPage, swaggerSpec } from './swagger.js';

const app = express();
const PORT = process.env.PORT || 4002;

const ALLOWED_ORIGINS = new Set([
  'http://localhost:4001',
  'https://fcard-gui.vercel.app',
]);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (ALLOWED_ORIGINS.has(origin)) {
      callback(null, origin);
      return;
    }
    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

const dbReady = initDb();

app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }
  try {
    await dbReady;
    next();
  } catch (err) {
    next(err);
  }
});

app.use(express.json());

app.get('/api/docs.json', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  res.json({
    ...swaggerSpec,
    servers: [{ url: origin, description: 'Current deployment' }],
  });
});
app.get(['/api/docs', '/api/docs/'], (_req, res) => {
  res.type('html').send(renderSwaggerUiPage('/api/docs.json'));
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/dictionary', dictionaryRouter);
app.use('/api/participants', participantsRouter);
app.use('/api/translate', translateRouter);

if (!process.env.VERCEL) {
  dbReady
    .then(() => {
      const server = app.listen(PORT, () => {
        console.log(`API running at http://localhost:${PORT}`);
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(
            `Port ${PORT} đang được dùng. Chạy: pnpm predev rồi thử lại.`
          );
          process.exit(1);
        }
        throw err;
      });

      function shutdown(): void {
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 1000).unref();
      }

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    })
    .catch((err: unknown) => {
      console.error('Không khởi tạo được database:', err);
      process.exit(1);
    });
}

export default app;
