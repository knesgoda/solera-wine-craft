import { SEOHead } from "@/components/SEOHead";

export default function PrivacyPage() {
  return (
    <>
      <SEOHead title="Privacy Policy — Solera" description="Solera's privacy policy." noIndex />
      <section className="pt-28 pb-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-4xl font-bold">Privacy Policy</h1>
        </div>
      </section>
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <p className="text-muted-foreground">Privacy policy content coming soon. Contact kevin@solera.vin with any questions.</p>
        </div>
      </section>
    </>
  );
}
