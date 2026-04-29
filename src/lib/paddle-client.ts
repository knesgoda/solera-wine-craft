import { initializePaddle, type Paddle } from '@paddle/paddle-js';

let paddleInstance: Paddle | undefined;

// Publishable client-side token — safe to expose
const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
const PADDLE_ENV = (import.meta.env.VITE_PADDLE_ENV || 'production') as 'production' | 'sandbox';

export async function getPaddle(): Promise<Paddle | undefined> {
  if (!PADDLE_CLIENT_TOKEN) {
    throw new Error('Paddle client token is not configured. Check environment variables.');
  }

  if (!paddleInstance && PADDLE_CLIENT_TOKEN) {
    paddleInstance = await initializePaddle({
      environment: PADDLE_ENV as 'production' | 'sandbox',
      token: PADDLE_CLIENT_TOKEN,
    });
  }
  return paddleInstance;
}
