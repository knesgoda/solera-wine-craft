import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface AdminNotifyProps {
  subject?: string
  body?: string
}

const AdminNotifyEmail = ({ subject, body }: AdminNotifyProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{subject || 'Solera admin notification'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}><Heading style={logo}>S O L E R A · ADMIN</Heading></Section>
        <Hr style={divider} />
        <Heading style={h1}>{subject || 'Notification'}</Heading>
        {(body || '').split(/\n+/).map((line, i) => (
          <Text key={i} style={text}>{line}</Text>
        ))}
        <Hr style={divider} />
        <Text style={footer}>Solera platform notification</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminNotifyEmail,
  subject: (d: Record<string, any>) => `[Solera] ${d.subject || 'Admin notification'}`,
  displayName: 'Admin notification',
  previewData: { subject: 'New user registered: jane@example.com', body: 'Name: Jane Doe\nEmail: jane@example.com\nOrganization: Acme Winery\nTier: hobbyist' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Times New Roman', serif" }
const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logo = { fontSize: '12px', fontWeight: '600' as const, letterSpacing: '4px', color: '#6B1B2A', margin: '0' }
const divider = { borderColor: '#E8E0D4', margin: '20px 0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#444', lineHeight: '1.6', margin: '0 0 8px', fontFamily: 'Arial, Helvetica, sans-serif' }
const footer = { fontSize: '11px', color: '#999', textAlign: 'center' as const, margin: '0', fontFamily: 'Arial, Helvetica, sans-serif' }
