import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface ClientInviteProps {
  facilityName?: string
  inviteUrl?: string
  expiryHours?: number
}

const ClientInviteEmail = ({ facilityName, inviteUrl, expiryHours }: ClientInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${facilityName || 'Your custom crush facility'} invited you to the Solera client portal`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}><Heading style={logo}>S O L E R A</Heading></Section>
        <Hr style={divider} />
        <Heading style={h1}>You're invited to the {facilityName || 'Solera'} client portal</Heading>
        <Text style={text}>
          {facilityName || 'Your custom crush facility'} has invited you to access your wine production data through the Solera client portal. Click below to accept and create your account.
        </Text>
        {inviteUrl && <Button style={button} href={inviteUrl}>Accept Invitation</Button>}
        <Text style={small}>This invitation expires in {expiryHours || 48} hours.</Text>
        <Hr style={divider} />
        <Text style={footer}>© {new Date().getFullYear()} Solera · Client Portal</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ClientInviteEmail,
  subject: (d: Record<string, any>) => `${d.facilityName || 'Solera'} invited you to the client portal`,
  displayName: 'Client portal invitation',
  previewData: { facilityName: 'Sunrise Ridge Winery', inviteUrl: 'https://solera.vin/client/signup?token=abc', expiryHours: 48 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Times New Roman', serif" }
const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logo = { fontSize: '14px', fontWeight: '600' as const, letterSpacing: '4px', color: '#6B1B2A', margin: '0' }
const divider = { borderColor: '#E8E0D4', margin: '24px 0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1A1A1A', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#444', lineHeight: '1.6', margin: '0 0 24px', fontFamily: 'Arial, Helvetica, sans-serif' }
const button = { backgroundColor: '#6B1B2A', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '6px', padding: '14px 28px', textDecoration: 'none', fontFamily: 'Arial, Helvetica, sans-serif' }
const small = { fontSize: '13px', color: '#777', margin: '20px 0 0', fontFamily: 'Arial, Helvetica, sans-serif' }
const footer = { fontSize: '12px', color: '#999', textAlign: 'center' as const, margin: '0', fontFamily: 'Arial, Helvetica, sans-serif' }
