import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Solera"

interface ReferralConversionProps {
  referrerName?: string
  creditDays?: number
  totalBalance?: number
}

const ReferralConversionEmail = ({ referrerName, creditDays = 30, totalBalance = 30 }: ReferralConversionProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your referral just went paid — you earned {creditDays} free days</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>S O L E R A</Heading>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>
          {referrerName ? `Great news, ${referrerName}!` : 'Great news!'}
        </Heading>
        <Text style={text}>
          Your referral just converted to a paid subscription. That means you've
          earned <strong>{creditDays} free days</strong> of Solera.
        </Text>
        <Text style={highlight}>
          Current balance: {totalBalance} free days
        </Text>
        <Text style={text}>
          Keep sharing your referral link to earn up to 180 days total. Every
          referral that converts to a paid Pro or Growth plan earns you another
          30 days.
        </Text>
        <Text style={text}>
          Thanks for spreading the word — it means a lot.
        </Text>
        <Text style={signoff}>
          Cheers,
        </Text>
        <Text style={signoffName}>
          Kevin
        </Text>
        <Hr style={divider} />
        <Text style={footer}>
          © {new Date().getFullYear()} Solera · Built for winemakers
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReferralConversionEmail,
  subject: (data: Record<string, any>) =>
    `Your referral just went paid — you earned ${data.creditDays || 30} free days`,
  displayName: 'Referral conversion notification',
  previewData: { referrerName: 'Maria', creditDays: 30, totalBalance: 60 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Times New Roman', serif" }
const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logo = {
  fontSize: '14px',
  fontWeight: '600' as const,
  letterSpacing: '4px',
  color: '#6B1B2A',
  margin: '0',
  fontFamily: "Georgia, 'Times New Roman', serif",
}
const divider = { borderColor: '#E8E0D4', margin: '24px 0' }
const h1 = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#1A1A1A',
  margin: '0 0 20px',
  fontFamily: "Georgia, 'Times New Roman', serif",
}
const text = {
  fontSize: '15px',
  color: '#444444',
  lineHeight: '1.6',
  margin: '0 0 16px',
  fontFamily: "Arial, Helvetica, sans-serif",
}
const highlight = {
  fontSize: '18px',
  fontWeight: '700' as const,
  color: '#6B1B2A',
  textAlign: 'center' as const,
  padding: '16px',
  backgroundColor: '#F5F0E8',
  borderRadius: '8px',
  margin: '0 0 16px',
  fontFamily: "Arial, Helvetica, sans-serif",
}
const signoff = {
  ...text,
  margin: '24px 0 2px',
}
const signoffName = {
  fontSize: '15px',
  color: '#6B1B2A',
  fontWeight: '600' as const,
  margin: '0 0 0',
  fontFamily: "Arial, Helvetica, sans-serif",
}
const footer = {
  fontSize: '12px',
  color: '#999999',
  textAlign: 'center' as const,
  margin: '0',
  fontFamily: "Arial, Helvetica, sans-serif",
}
