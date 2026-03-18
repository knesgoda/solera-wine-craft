import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Clock, Send, CheckCircle } from "lucide-react";

const SUBJECTS = ["Sales", "Support", "Migration Help", "Press", "Other"];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.subject || !form.message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (form.name.length > 100 || form.email.length > 255 || form.message.length > 5000) {
      toast.error("One or more fields exceed the maximum length");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-contact", {
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject,
          message: form.message.trim(),
        },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      toast.error("Failed to send message. Please email kevin@solera.vin directly.");
    }
    setLoading(false);
  };

  return (
    <>
      <SEOHead
        title="Contact Solera — Get in Touch"
        description="Have a question about Solera? Reach out for sales, support, migration help, or press inquiries. We typically respond within one business day."
        canonicalUrl="https://solera.vin/contact"
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "Contact", url: "https://solera.vin/contact" },
        ]}
      />

      <section className="bg-primary py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground">Get in Touch</h1>
          <p className="text-primary-foreground/70 mt-3 text-lg">
            Have a question or want to talk wine? We'd love to hear from you.
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Contact info */}
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-5 h-5 text-secondary" />
                  <h3 className="font-display font-semibold text-foreground">Email Directly</h3>
                </div>
                <a href="mailto:kevin@solera.vin" className="text-primary hover:underline">
                  kevin@solera.vin
                </a>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-secondary" />
                  <h3 className="font-display font-semibold text-foreground">Response Time</h3>
                </div>
                <p className="text-muted-foreground">Typically within one business day.</p>
              </div>
            </div>

            {/* Contact form */}
            <div className="md:col-span-2">
              {sent ? (
                <div className="text-center py-16 bg-card rounded-xl border border-border">
                  <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h2 className="font-display text-2xl font-bold text-foreground mb-2">Message Sent!</h2>
                  <p className="text-muted-foreground mb-6">
                    Thanks for reaching out. We'll get back to you within one business day.
                  </p>
                  <Button variant="outline" onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }}>
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 md:p-8 rounded-xl border border-border">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Your name"
                        maxLength={100}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="you@example.com"
                        maxLength={255}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a topic" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECTS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="How can we help?"
                      rows={6}
                      maxLength={5000}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    {loading ? "Sending..." : (
                      <>
                        <Send className="w-4 h-4 mr-2" /> Send Message
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
