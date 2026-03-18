import { SEOHead } from "@/components/SEOHead";

export default function TermsPage() {
  return (
    <>
      <SEOHead title="Terms of Service — Solera" description="Solera's terms of service." noIndex />
      <section className="pt-28 pb-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-4xl font-bold">Terms of Service</h1>
        </div>
      </section>
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <p className="text-muted-foreground">Terms of service content coming soon. Contact kevin@solera.vin with any questions.</p>
        </div>
      </section>
    </>
  );
}
