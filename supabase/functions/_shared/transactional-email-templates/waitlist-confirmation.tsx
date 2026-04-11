import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Solera"

interface WaitlistConfirmationProps {
  firstName?: string
}

const WaitlistConfirmationEmail = ({ firstName }: WaitlistConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're on the Solera waitlist — we'll be in touch soon.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>S O L E R A</Heading>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>
          {firstName ? `Welcome, ${firstName}.` : 'Welcome.'}
        </Heading>
        <Text style={text}>
          You're on the list. We're putting the finishing touches on Solera — the complete
          winery management platform built for winemakers who are serious about their craft.
        </Text>
        <Text style={text}>
          We'll reach out before we open the doors with an exclusive early-access offer.
          In the meantime, if you have any questions, just reply to this email.
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
  component: WaitlistConfirmationEmail,
  subject: "You're on the Solera waitlist",
  displayName: 'Waitlist confirmation',
  previewData: { firstName: 'Maria' },
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
const footer = {
  fontSize: '12px',
  color: '#999999',
  textAlign: 'center' as const,
  margin: '0',
  fontFamily: "Arial, Helvetica, sans-serif",
}
