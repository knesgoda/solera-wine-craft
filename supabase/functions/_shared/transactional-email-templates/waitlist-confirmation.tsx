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
    <Preview>You're on the list — and I'm glad you're here.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>S O L E R A</Heading>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>
          {firstName ? `Hey ${firstName},` : 'Hey there,'}
        </Heading>
        <Text style={text}>
          You're on the list — and I'm glad you're here.
        </Text>
        <Text style={text}>
          I'm Kevin, the founder. I built Solera because I spent years watching
          winemakers I respect make million-dollar decisions in Excel while paying
          $700 a month for tools that still didn't talk to each other. That felt
          wrong, and eventually I stopped complaining about it and built something
          better.
        </Text>
        <Text style={textBold}>
          Here's what you're getting access to when we launch:
        </Text>
        <Text style={listItem}>
          ✦ One platform covering vineyard ops, cellar management, COGS tracking,
          DTC sales, and AI-powered harvest intelligence — no duct tape required
        </Text>
        <Text style={listItem}>
          ✦ Pricing that starts at $69/month, with a free tier for hobbyists
        </Text>
        <Text style={listItem}>
          ✦ An AI co-pilot that answers questions about your actual data, not
          generic winemaking advice
        </Text>
        <Text style={text}>
          And because you signed up early, you'll get an exclusive offer before
          we open to the public. More on that closer to launch.
        </Text>
        <Text style={text}>
          In the meantime, if you have questions or just want to talk wine, reply
          to this email. I read every one.
        </Text>
        <Text style={text}>
          Know another winemaker who's tired of the old way? Forward this to them.
        </Text>
        <Text style={signoff}>
          Talk soon,
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
const textBold = {
  ...text,
  fontWeight: '600' as const,
  color: '#1A1A1A',
  margin: '0 0 12px',
}
const listItem = {
  ...text,
  margin: '0 0 10px',
  paddingLeft: '8px',
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
