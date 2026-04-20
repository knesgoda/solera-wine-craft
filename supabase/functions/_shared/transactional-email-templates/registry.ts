/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as waitlistConfirmation } from './waitlist-confirmation.tsx'
import { template as waitlistAdminNotify } from './waitlist-admin-notify.tsx'
import { template as referralConversion } from './referral-conversion.tsx'
import { template as labAlert } from './lab-alert.tsx'
import { template as harvestAlert } from './harvest-alert.tsx'
import { template as anomalyDigest } from './anomaly-digest.tsx'
import { template as weeklySummary } from './weekly-summary.tsx'
import { template as backupReady } from './backup-ready.tsx'
import { template as clientInvite } from './client-invite.tsx'
import { template as clientMessageNotify } from './client-message-notify.tsx'
import { template as adminNotify } from './admin-notify.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'waitlist-confirmation': waitlistConfirmation,
  'waitlist-admin-notify': waitlistAdminNotify,
  'referral-conversion': referralConversion,
  'lab-alert': labAlert,
  'harvest-alert': harvestAlert,
  'anomaly-digest': anomalyDigest,
  'weekly-summary': weeklySummary,
  'backup-ready': backupReady,
  'client-invite': clientInvite,
  'client-message-notify': clientMessageNotify,
  'admin-notify': adminNotify,
}
