// Solera brand styles shared across all email templates.
// Keep in sync with mem://ui/email-branding (Crimson #6B1B2A, Gold #C8902A, Cream #F5F0E8, Georgia serif).

export const brandColors = {
  crimson: '#6B1B2A',
  gold: '#C8902A',
  cream: '#F5F0E8',
  ink: '#1A1A1A',
  body: '#444444',
  muted: '#777777',
  divider: '#E8E0D4',
  light: '#999999',
}

export const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Times New Roman', serif" }
export const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
export const headerSection = { textAlign: 'center' as const, marginBottom: '8px' }
export const logo = {
  fontSize: '14px',
  fontWeight: '600' as const,
  letterSpacing: '4px',
  color: brandColors.crimson,
  margin: '0',
  fontFamily: "Georgia, 'Times New Roman', serif",
}
export const divider = { borderColor: brandColors.divider, margin: '24px 0' }
export const h1 = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: brandColors.ink,
  margin: '0 0 20px',
  fontFamily: "Georgia, 'Times New Roman', serif",
}
export const h2 = {
  fontSize: '18px',
  fontWeight: '600' as const,
  color: brandColors.crimson,
  margin: '0 0 12px',
  fontFamily: "Georgia, 'Times New Roman', serif",
}
export const text = {
  fontSize: '15px',
  color: brandColors.body,
  lineHeight: '1.6',
  margin: '0 0 16px',
  fontFamily: 'Arial, Helvetica, sans-serif',
}
export const link = { color: brandColors.crimson, textDecoration: 'underline' }
export const button = {
  backgroundColor: brandColors.crimson,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '6px',
  padding: '14px 28px',
  textDecoration: 'none',
  fontFamily: 'Arial, Helvetica, sans-serif',
}
export const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: brandColors.crimson,
  letterSpacing: '4px',
  margin: '0 0 30px',
  padding: '16px',
  backgroundColor: brandColors.cream,
  borderRadius: '6px',
  textAlign: 'center' as const,
}
export const footer = {
  fontSize: '13px',
  color: brandColors.muted,
  margin: '24px 0 0',
  fontFamily: 'Arial, Helvetica, sans-serif',
}
export const brandFooter = {
  fontSize: '12px',
  color: brandColors.light,
  textAlign: 'center' as const,
  margin: '0',
  fontFamily: 'Arial, Helvetica, sans-serif',
}

export const brandFooterText = `© ${new Date().getFullYear()} Solera · Built for winemakers`