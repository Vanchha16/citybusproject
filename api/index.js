// Vercel serverless entry: the same Express API as `npm run dev`, as one function.
// vercel.json routes every /api/* request here.
import { app } from '../server/src/index.js';

export default app;
