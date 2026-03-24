import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finance Tracker API',
      version: '1.0.0',
      description: 'REST API for the Finance Tracker application. Use the /api/auth/login endpoint to get a Bearer token, then click Authorize to use protected routes.',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local dev server' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',          description: 'Register, login, profile' },
      { name: 'Overview',      description: 'Aggregated dashboard data' },
      { name: 'Banks',         description: 'Bank account CRUD' },
      { name: 'Transactions',  description: 'Income and expense transactions' },
      { name: 'Credit',        description: 'Credit cards and CC transactions' },
      { name: 'Drive',         description: 'File and folder management' },
      { name: 'Events',        description: 'Calendar events' },
      { name: 'Notes',         description: 'Notes and to-dos' },
      { name: 'Notifications', description: 'In-app notifications' },
      { name: 'Settings',      description: 'User settings and profile' },
    ],
  },
  apis: ['./src/docs/*.yaml'],
};

export const swaggerSpec = swaggerJsdoc(options);
