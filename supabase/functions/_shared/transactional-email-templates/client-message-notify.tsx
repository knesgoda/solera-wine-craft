import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface ClientMessageProps {
  clientName?: string
  messagePreview?: string
  ctaUrl?: string
}

const ClientMessageEmail = ({ clientName, messagePreview, ctaUrl }: ClientMessageProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New message in the client portal</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}><Heading style={logo}>S O L E R A</Heading></Section>
        <Hr style={divider} />
        <Heading style={h1}>New client message</Heading>
        {clientName && <Text style={subtitle}>From: {clientName}</Text>}
        {messagePreview && <Text style={quote}>{messagePreview}</Text>}
        {ctaUrl && <Button style={button} href={ctaUrl}>Reply in Solera</Button>}
        <Hr style={divider} />
        <Text style={footer}>© {new Date().getFullYear()} Solera · Client Portal</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ClientMessageEmail,
  subject: (d: Record<string, any>) => `New message${d.clientName ? ` from ${d.clientName}` : ''}`,
  displayName: 'Client message notification',
  previewData: { clientName: 'Maria Rivera', messagePreview: 'Quick question about the latest lab numbers on lot 12...', ctaUrl: 'https://solera.vin/clients' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Times New Roman', serif" }
const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logo = { fontSize: '14px', fontWeight: '600' as const, letterSpacing: '4px', color: '#6B1B2A', margin: '0' }
const divider = { borderColor: '#E8E0D4', margin: '24px 0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1A1A1A', margin: '0 0 8px' }
const subtitle = { fontSize: '14px', color: '#777', margin: '0 0 16px', fontFamily: 'Arial, Helvetica, sans-serif' }
const quote = { fontSize: '15px', color: '#444', lineHeight: '1.6', margin: '0 0 24px', padding: '12px 16px', backgroundColor: '#F5F0E8', borderLeft: '3px solid #6B1B2A', fontFamily: 'Arial, Helvetica, sans-serif', fontStyle: 'italic' as const }
const button = { backgroundColor: '#6B1B2A', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '6px', padding: '14px 28px', textDecoration: 'none', fontFamily: 'Arial, Helvetica, sans-serif' }
const footer = { fontSize: '12px', color: '#999', textAlign: 'center' as const, margin: '0', fontFamily: 'Arial, Helvetica, sans-serif' }
