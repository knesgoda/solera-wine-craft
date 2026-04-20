import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface BackupReadyProps {
  downloadUrl?: string
  format?: string
  expiresAt?: string
  reason?: string
}

const BackupReadyEmail = ({ downloadUrl, format, expiresAt, reason }: BackupReadyProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Solera data backup is ready to download</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}><Heading style={logo}>S O L E R A</Heading></Section>
        <Hr style={divider} />
        <Heading style={h1}>Your backup is ready</Heading>
        <Text style={text}>
          Your {format || 'data'} backup has been generated and is ready to download.
          {reason ? ` (${reason})` : ''}
        </Text>
        {downloadUrl && <Button style={button} href={downloadUrl}>Download Backup</Button>}
        {expiresAt && <Text style={small}>Link expires: {expiresAt}</Text>}
        <Hr style={divider} />
        <Text style={footer}>© {new Date().getFullYear()} Solera · Data Backups</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BackupReadyEmail,
  subject: 'Your Solera backup is ready',
  displayName: 'Backup ready',
  previewData: { downloadUrl: 'https://example.test/backup.zip', format: 'CSV (ZIP)', expiresAt: 'in 7 days' },
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
