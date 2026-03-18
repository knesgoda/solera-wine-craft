import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOHead } from "@/components/SEOHead";
import { Heart, DollarSign, Sparkles, Mail } from "lucide-react";

export default function AboutPage() {
  return (
    <>
      <SEOHead
        title="About Solera — Built by a Winemaker, for Winemakers"
        description="Meet Kevin Nesgoda, founder of Solera. Learn the story behind the winery management platform built for the AI era."
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "About", url: "https://solera.vin/about" },
        ]}
      />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold">Built by a winemaker, for winemakers.</h1>
        </div>
      </section>

      {/* Founder Story */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <div className="text-center mb-12">
            <div className="w-24 h-24 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-3xl font-display font-bold mx-auto mb-6">
              KN
            </div>
            <h2 className="font-display text-3xl font-bold text-foreground">Kevin Nesgoda, Founder</h2>
          </div>

          <div className="prose prose-lg max-w-none text-foreground leading-relaxed space-y-6">
            <p>
              I fell in love with wine under an old oak tree in the Santa Ynez Valley in 2005. A glass of Pinot Noir, the late afternoon light through the leaves, and something clicked that never unclicked.
            </p>
            <p>
              Twenty years later I'd watched the wine industry I loved struggle with software that hadn't kept pace with the world. Winemakers making million-dollar decisions with spreadsheets. Harvest windows missed because data lived in three different places. Small boutique wineries priced out of the tools that big operations took for granted.
            </p>
            <p>
              In 2021 I made an Albariño in honor of my grandmother, who passed that year. It won two silver medals and a gold. It also took me two weeks to reconcile the lab data in Excel afterward.
            </p>
            <p>
              That was enough. I built Solera to give every winemaker — from the hobbyist with one block in their backyard to the custom crush facility running fifty client labels — the operational intelligence they deserve. AI-powered, honestly priced, and built by someone who has sat under that oak and understood exactly what was at stake in that glass.
            </p>
            <p className="text-secondary font-semibold italic">
              — Kevin Nesgoda, Solera
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold text-foreground mb-6">Our Mission</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Our mission is to give every winemaker the tech they need to keep up with a world that moves faster every day. Decisions need to be made faster. Data needs to be clearer. And the tools need to be affordable enough that no winery gets left behind.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-12">Our Values</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Heart, title: "Winemaker First", desc: "Every feature decision starts with 'does this make a winemaker's life better?' If the answer isn't yes, we don't build it." },
              { icon: DollarSign, title: "Honest Pricing", desc: "No hidden fees, no surprise markups, no lock-in. You always know what you're paying and why." },
              { icon: Sparkles, title: "Built for the AI Era", desc: "AI isn't a gimmick here — it's woven into every decision Solera helps you make, from harvest timing to anomaly detection." },
            ].map((v) => (
              <Card key={v.title} className="bg-card">
                <CardContent className="p-8 text-center">
                  <v.icon className="h-10 w-10 text-primary mx-auto mb-4" />
                  <h3 className="font-display text-xl font-semibold text-foreground mb-3">{v.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 lg:px-8 text-center max-w-2xl">
          <Mail className="h-10 w-10 text-secondary mx-auto mb-6" />
          <h2 className="font-display text-3xl font-bold mb-4">Have a question or want to talk wine?</h2>
          <p className="text-primary-foreground/80 mb-8">Reach Kevin directly.</p>
          <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" asChild>
            <a href="mailto:kevin@solera.vin">kevin@solera.vin</a>
          </Button>
        </div>
      </section>
    </>
  );
}
