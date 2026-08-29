import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { openingsRouter } from './openings.routes.js';
import { applicationsRouter } from './applications.routes.js';
import { alertsRouter } from './alerts.routes.js';
import { dashboardRouter } from './dashboard.routes.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/openings', openingsRouter);
apiRouter.use('/applications', applicationsRouter);
apiRouter.use('/alerts', alertsRouter);
apiRouter.use('/dashboard', dashboardRouter);
