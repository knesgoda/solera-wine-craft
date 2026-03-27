import { useEffect } from "react";

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, any> | Record<string, any>[];
  breadcrumbs?: { name: string; url: string }[];
}

const DEFAULTS = {
  title: "Solera — From Vine to Bottle to Doorstep. One Platform.",
  description:
    "Solera is the complete winery management platform built for the AI era. Manage your vineyard, cellar, lab data, TTB compliance, and DTC sales in one place. Free for hobbyists. From $69/mo for wineries.",
  ogImage: "https://solera.vin/og-default.png",
  ogType: "website",
};

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Solera",
  url: "https://solera.vin",
  logo: "https://solera.vin/logo.png",
  founder: { "@type": "Person", name: "Kevin Nesgoda" },
  foundingDate: "2026",
  description: "Winery management software built for the AI era",
};

export function SEOHead({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogType,
  noIndex = false,
  jsonLd,
  breadcrumbs,
}: SEOHeadProps) {
  const finalTitle = title || DEFAULTS.title;
  const finalDesc = description || DEFAULTS.description;
  const finalOgImage = ogImage || DEFAULTS.ogImage;
  const finalOgType = ogType || DEFAULTS.ogType;
  const finalCanonical = canonicalUrl || (typeof window !== "undefined" ? window.location.origin + window.location.pathname : "");

  useEffect(() => {
    // Title
    document.title = finalTitle;

    // Helper to set/create meta tags
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    // Standard meta
    setMeta("name", "description", finalDesc);
    if (noIndex) setMeta("name", "robots", "noindex,nofollow");

    // Open Graph
    setMeta("property", "og:title", finalTitle);
    setMeta("property", "og:description", finalDesc);
    setMeta("property", "og:image", finalOgImage);
    setMeta("property", "og:type", finalOgType);
    setMeta("property", "og:url", finalCanonical);
    setMeta("property", "og:site_name", "Solera");

    // Twitter
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", finalTitle);
    setMeta("name", "twitter:description", finalDesc);
    setMeta("name", "twitter:image", finalOgImage);

    // Canonical
    let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalEl) {
      canonicalEl = document.createElement("link");
      canonicalEl.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute("href", finalCanonical);

    // JSON-LD
    // Remove previous SEO scripts
    document.querySelectorAll('script[data-seo-ld]').forEach((el) => el.remove());

    // Always add org schema
    const orgScript = document.createElement("script");
    orgScript.type = "application/ld+json";
    orgScript.setAttribute("data-seo-ld", "org");
    orgScript.textContent = JSON.stringify(ORG_SCHEMA);
    document.head.appendChild(orgScript);

    // Custom JSON-LD
    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      items.forEach((ld, i) => {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-ld", `custom-${i}`);
        script.textContent = JSON.stringify(ld);
        document.head.appendChild(script);
      });
    }

    // Breadcrumbs
    if (breadcrumbs && breadcrumbs.length > 0) {
      const bcLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((bc, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: bc.name,
          item: bc.url,
        })),
      };
      const bcScript = document.createElement("script");
      bcScript.type = "application/ld+json";
      bcScript.setAttribute("data-seo-ld", "breadcrumbs");
      bcScript.textContent = JSON.stringify(bcLd);
      document.head.appendChild(bcScript);
    }

    return () => {
      document.querySelectorAll('script[data-seo-ld]').forEach((el) => el.remove());
    };
  }, [finalTitle, finalDesc, finalOgImage, finalOgType, finalCanonical, noIndex, jsonLd, breadcrumbs]);

  return null;
}

// Pre-built JSON-LD schemas

export const HOMEPAGE_SCHEMA = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Solera",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    description: "Complete winery management platform from vineyard to DTC sales",
    url: "https://solera.vin",
    offers: [
      { "@type": "Offer", name: "Hobbyist", price: "0", priceCurrency: "USD" },
      { "@type": "Offer", name: "Pro", price: "69", priceCurrency: "USD", billingPeriod: "P1M" },
      { "@type": "Offer", name: "Growth", price: "129", priceCurrency: "USD", billingPeriod: "P1M" },
      { "@type": "Offer", name: "Enterprise", price: "399", priceCurrency: "USD", billingPeriod: "P1M" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Solera",
    url: "https://solera.vin",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://solera.vin/blog?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  },
];

export function buildFaqSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildBlogPostSchema(post: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  author: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: `https://solera.vin/blog/${post.slug}`,
    datePublished: post.publishedAt,
    author: { "@type": "Person", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "Solera",
      logo: { "@type": "ImageObject", url: "https://solera.vin/logo.png" },
    },
    ...(post.image && { image: post.image }),
  };
}
