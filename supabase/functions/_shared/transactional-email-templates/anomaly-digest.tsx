import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface AnomalyDigestProps {
  anomalies?: Array<{ vintage?: string; parameter?: string; message?: string }>
  summary?: string
}

const AnomalyDigestEmail = ({ anomalies = [], summary }: AnomalyDigestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Solera anomaly scan results</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}><Heading style={logo}>S O L E R A</Heading></Section>
        <Hr style={divider} />
        <Heading style={h1}>Anomaly Detection</Heading>
        {summary && <Text style={text}>{summary}</Text>}
        {anomalies.map((a, i) => (
          <Text key={i} style={item}>
            <strong>{a.vintage || 'Vintage'}</strong> — {a.parameter}: {a.message}
          </Text>
        ))}
        {anomalies.length === 0 && <Text style={text}>No new anomalies detected.</Text>}
        <Hr style={divider} />
        <Text style={footer}>© {new Date().getFullYear()} Solera · Daily Anomaly Scan</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AnomalyDigestEmail,
  subject: (d: Record<string, any>) => `Solera: ${(d.anomalies?.length || 0)} anomal${(d.anomalies?.length || 0) === 1 ? 'y' : 'ies'} detected`,
  displayName: 'Anomaly digest',
  previewData: { summary: '2 anomalies were detected in your fermentations today.', anomalies: [{ vintage: 'Cab 2024', parameter: 'VA', message: 'Volatile acidity spiked to 0.85 g/L (range 0.3-0.6).' }, { vintage: 'Pinot 2024', parameter: 'Brix', message: 'Brix has stalled at 8.2 for 4 days.' }] },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Times New Roman', serif" }
const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logo = { fontSize: '14px', fontWeight: '600' as const, letterSpacing: '4px', color: '#6B1B2A', margin: '0' }
const divider = { borderColor: '#E8E0D4', margin: '24px 0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#6B1B2A', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#444', lineHeight: '1.6', margin: '0 0 16px', fontFamily: 'Arial, Helvetica, sans-serif' }
const item = { fontSize: '14px', color: '#444', lineHeight: '1.6', margin: '0 0 10px', paddingLeft: '8px', borderLeft: '3px solid #C8902A', paddingTop: '4px', paddingBottom: '4px', fontFamily: 'Arial, Helvetica, sans-serif' }
const footer = { fontSize: '12px', color: '#999', textAlign: 'center' as const, margin: '0', fontFamily: 'Arial, Helvetica, sans-serif' }
