import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface HarvestAlertProps {
  alertText?: string
  blockName?: string
  vineyardName?: string
  predictedDate?: string
  currentBrix?: number
  ctaUrl?: string
}

const HarvestAlertEmail = ({ alertText, blockName, vineyardName, ctaUrl }: HarvestAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>🍇 Harvest window approaching</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}><Heading style={logo}>S O L E R A</Heading></Section>
        <Hr style={divider} />
        <Heading style={h1}>🍇 Harvest Window Alert</Heading>
        {(blockName || vineyardName) && (
          <Text style={subtitle}>{blockName}{vineyardName ? ` · ${vineyardName}` : ''}</Text>
        )}
        <Text style={text}>{alertText || 'A block is approaching its prime harvest window.'}</Text>
        {ctaUrl && <Button style={button} href={ctaUrl}>View Block in Solera</Button>}
        <Hr style={divider} />
        <Text style={footer}>© {new Date().getFullYear()} Solera · Harvest Alerts</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: HarvestAlertEmail,
  subject: (d: Record<string, any>) => `🍇 Harvest Window Alert${d.blockName ? `: ${d.blockName}` : ''}`,
  displayName: 'Harvest window alert',
  previewData: { alertText: 'Block A at Sunrise Ridge is projected to enter its prime harvest window on October 12, 2026. Current Brix: 22.8.', blockName: 'Block A', vineyardName: 'Sunrise Ridge', ctaUrl: 'https://solera.vin/operations/blocks/abc' },
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
