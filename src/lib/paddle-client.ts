import { initializePaddle, type Paddle } from '@paddle/paddle-js';

let paddleInstance: Paddle | undefined;

// Client-side token — safe to expose (publishable key)
// Publishable client-side token — safe to expose
const PADDLE_CLIENT_TOKEN = 'live_611063221d47715bf99c3aabf8e';
const PADDLE_ENV: 'production' | 'sandbox' = 'production';

export async function getPaddle(): Promise<Paddle | undefined> {
  if (!paddleInstance && PADDLE_CLIENT_TOKEN) {
    paddleInstance = await initializePaddle({
      environment: PADDLE_ENV as 'production' | 'sandbox',
      token: PADDLE_CLIENT_TOKEN,
    });
  }
  return paddleInstance;
}
