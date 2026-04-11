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

export const TEMPLATES: Record<string, TemplateEntry> = {
  'waitlist-confirmation': waitlistConfirmation,
  'waitlist-admin-notify': waitlistAdminNotify,
}
