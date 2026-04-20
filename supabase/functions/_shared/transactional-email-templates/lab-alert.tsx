import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface LabAlertProps {
  alertText?: string
  parameter?: string
  vintageName?: string
  ctaUrl?: string
}

const LabAlertEmail = ({ alertText, parameter, vintageName, ctaUrl }: LabAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Solera Alert: ${parameter || 'Lab parameter'} threshold breached`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}><Heading style={logo}>S O L E R A</Heading></Section>
        <Hr style={divider} />
        <Heading style={h1}>🔔 Lab Alert</Heading>
        {vintageName && <Text style={subtitle}>{vintageName}</Text>}
        <Text style={text}>{alertText || 'A lab parameter has crossed your alert threshold.'}</Text>
        {ctaUrl && (
          <Button style={button} href={ctaUrl}>View in Solera</Button>
        )}
        <Hr style={divider} />
        <Text style={footer}>© {new Date().getFullYear()} Solera · Lab Alerts</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LabAlertEmail,
  subject: (d: Record<string, any>) => `🔔 Solera Alert: ${d.parameter || 'Lab parameter'} threshold breached`,
  displayName: 'Lab alert',
  previewData: { alertText: 'Brix on Cab Sauv 2024 reached 24.2 (threshold: 24.0).', parameter: 'Brix', vintageName: 'Cab Sauv 2024', ctaUrl: 'https://solera.vin/vintages' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Times New Roman', serif" }
const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logo = { fontSize: '14px', fontWeight: '600' as const, letterSpacing: '4px', color: '#6B1B2A', margin: '0' }
const divider = { borderColor: '#E8E0D4', margin: '24px 0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#6B1B2A', margin: '0 0 8px' }
const subtitle = { fontSize: '14px', color: '#777', margin: '0 0 16px', fontFamily: 'Arial, Helvetica, sans-serif' }
const text = { fontSize: '15px', color: '#444', lineHeight: '1.6', margin: '0 0 24px', fontFamily: 'Arial, Helvetica, sans-serif' }
const button = { backgroundColor: '#6B1B2A', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '6px', padding: '14px 28px', textDecoration: 'none', fontFamily: 'Arial, Helvetica, sans-serif' }
const footer = { fontSize: '12px', color: '#999', textAlign: 'center' as const, margin: '0', fontFamily: 'Arial, Helvetica, sans-serif' }
