export const PADDLE_PRICES = {
  hobbyist: {
    monthly: 'pri_01kmdwyrebec33s3kkrv4akap2',
  },
  pro: {
    monthly: 'pri_01kmdx9xd7y43185qppke728d9',
    annual:  'pri_01kmdxb9xev9x8823v4ssbvj1m',
  },
  growth: {
    monthly: 'pri_01kmdxcs28byfa4q5ye3kh1xj3',
    annual:  'pri_01kmdxeyq34dvq3mxex2xdyfwm',
  },
  enterprise: {
    monthly: 'pri_01kmdxkejxc2bssknbrm9phj48',
    annual:  'pri_01kmdxmnh6v670ng8dtz5skec8',
  },
} as const;

export const PRICE_TO_TIER: Record<string, string> = {
  'pri_01kmdwyrebec33s3kkrv4akap2': 'hobbyist',
  'pri_01kmdx9xd7y43185qppke728d9': 'pro',
  'pri_01kmdxb9xev9x8823v4ssbvj1m': 'pro',
  'pri_01kmdxcs28byfa4q5ye3kh1xj3': 'growth',
  'pri_01kmdxeyq34dvq3mxex2xdyfwm': 'growth',
  'pri_01kmdxkejxc2bssknbrm9phj48': 'enterprise',
  'pri_01kmdxmnh6v670ng8dtz5skec8': 'enterprise',
};

// All paid price IDs for PricePreview calls
export const ALL_PAID_PRICE_IDS = [
  'pri_01kmdx9xd7y43185qppke728d9',
  'pri_01kmdxb9xev9x8823v4ssbvj1m',
  'pri_01kmdxcs28byfa4q5ye3kh1xj3',
  'pri_01kmdxeyq34dvq3mxex2xdyfwm',
  'pri_01kmdxkejxc2bssknbrm9phj48',
  'pri_01kmdxmnh6v670ng8dtz5skec8',
] as const;
