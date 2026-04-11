import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface AdminNotifyProps {
  firstName?: string
  email?: string
  operationType?: string
  signedUpAt?: string
}

const WaitlistAdminNotifyEmail = ({ firstName, email, operationType, signedUpAt }: AdminNotifyProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New waitlist signup: {email || 'unknown'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Waitlist Signup</Heading>
        <Hr style={divider} />
        <Section style={detailSection}>
          <Text style={label}>Name</Text>
          <Text style={value}>{firstName || 'Not provided'}</Text>
          <Text style={label}>Email</Text>
          <Text style={value}>{email || 'Not provided'}</Text>
          <Text style={label}>Operation Type</Text>
          <Text style={value}>{operationType || 'Not provided'}</Text>
          <Text style={label}>Signed Up</Text>
          <Text style={value}>{signedUpAt || new Date().toISOString()}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WaitlistAdminNotifyEmail,
  subject: (data: Record<string, any>) => `New waitlist signup: ${data.email || 'unknown'}`,
  displayName: 'Waitlist admin notification',
  to: 'kevin@solera.vin',
  previewData: {
    firstName: 'Maria',
    email: 'maria@example.com',
    operationType: 'Small Boutique Winery',
    signedUpAt: '2026-04-11T12:00:00Z',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Arial, Helvetica, sans-serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#6B1B2A',
  margin: '0 0 16px',
  fontFamily: "Georgia, 'Times New Roman', serif",
}
const divider = { borderColor: '#E8E0D4', margin: '16px 0' }
const detailSection = { margin: '0' }
const label = {
  fontSize: '11px',
  fontWeight: '600' as const,
  color: '#999999',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '12px 0 2px',
}
const value = {
  fontSize: '15px',
  color: '#1A1A1A',
  margin: '0 0 8px',
}
