import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface WeeklySummaryProps {
  orgName?: string
  bodyMarkdown?: string
}

const WeeklySummaryEmail = ({ orgName, bodyMarkdown }: WeeklySummaryProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Your Solera weekly winery summary${orgName ? ` for ${orgName}` : ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}><Heading style={logo}>S O L E R A</Heading></Section>
        <Hr style={divider} />
        <Heading style={h1}>Your weekly summary</Heading>
        {orgName && <Text style={subtitle}>{orgName}</Text>}
        {(bodyMarkdown || '').split(/\n\n+/).map((para, i) => (
          <Text key={i} style={text}>{para}</Text>
        ))}
        <Hr style={divider} />
        <Text style={footer}>© {new Date().getFullYear()} Solera · Weekly Summary</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklySummaryEmail,
  subject: (d: Record<string, any>) => `Your Solera weekly summary${d.orgName ? ` — ${d.orgName}` : ''}`,
  displayName: 'Weekly summary',
  previewData: { orgName: 'Sunrise Ridge Winery', bodyMarkdown: 'This week you logged 12 lab samples and completed 8 tasks.\n\nFermentations are tracking on schedule.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Times New Roman', serif" }
const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logo = { fontSize: '14px', fontWeight: '600' as const, letterSpacing: '4px', color: '#6B1B2A', margin: '0' }
const divider = { borderColor: '#E8E0D4', margin: '24px 0' }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1A1A1A', margin: '0 0 8px' }
const subtitle = { fontSize: '14px', color: '#777', margin: '0 0 20px', fontFamily: 'Arial, Helvetica, sans-serif' }
const text = { fontSize: '15px', color: '#444', lineHeight: '1.7', margin: '0 0 16px', fontFamily: 'Arial, Helvetica, sans-serif' }
const footer = { fontSize: '12px', color: '#999', textAlign: 'center' as const, margin: '0', fontFamily: 'Arial, Helvetica, sans-serif' }
