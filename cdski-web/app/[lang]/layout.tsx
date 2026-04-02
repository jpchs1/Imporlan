import type { Metadata } from "next";
import { getDictionary, locales, type Locale } from "@/lib/dictionaries";
import "./globals.css";

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = (locales.includes(lang as Locale) ? lang : "es") as Locale;
  const dict = await getDictionary(locale);

  const langAlternates: Record<string, string> = {};
  for (const l of locales) {
    langAlternates[l] = `https://clasesdeski.cl/test/${l}/`;
  }

  return {
    title: dict.meta.title,
    description: dict.meta.description,
    keywords: dict.meta.keywords,
    metadataBase: new URL("https://clasesdeski.cl"),
    alternates: {
      canonical: `/test/${locale}/`,
      languages: langAlternates,
    },
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      url: `https://clasesdeski.cl/test/${locale}/`,
      siteName: "CDSKI — Clases de Ski y Snowboard Chile",
      locale: locale === "es" ? "es_CL" : locale === "pt" ? "pt_BR" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (locales.includes(lang as Locale) ? lang : "es") as Locale;
  const dict = await getDictionary(locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": "https://clasesdeski.cl/#business",
        name: "CDSKI — Clases de Ski y Snowboard Chile",
        description: dict.meta.description,
        url: "https://clasesdeski.cl",
        telephone: "+56940211459",
        email: "info@clasesdeski.cl",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Mall Sport",
          addressLocality: "Las Condes",
          addressRegion: "Región Metropolitana",
          addressCountry: "CL",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: -33.4028,
          longitude: -70.5756,
        },
        openingHours: "Mo-Su 08:00-22:00",
        priceRange: "$$",
        image: "https://clasesdeski.cl/wp-content/uploads/2022/08/grupal-1.png",
        sameAs: [
          "https://www.facebook.com/clasesdeski",
          "https://www.instagram.com/clasesdeski",
        ],
      },
      {
        "@type": "Course",
        name: "Ski & Snowboard Lessons",
        description: "Professional ski and snowboard lessons for all levels at Valle Nevado, El Colorado and La Parva",
        provider: { "@id": "https://clasesdeski.cl/#business" },
        hasCourseInstance: [
          {
            "@type": "CourseInstance",
            courseMode: "onsite",
            location: {
              "@type": "Place",
              name: "Valle Nevado Ski Resort",
              address: { "@type": "PostalAddress", addressCountry: "CL" },
            },
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: dict.faq.questions.map((q) => ({
          "@type": "Question",
          name: q.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: q.a,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `https://clasesdeski.cl/test/${locale}/`,
          },
        ],
      },
    ],
  };

  return (
    <html lang={locale === "pt" ? "pt-BR" : locale === "en" ? "en" : "es-CL"}>
      <head>
        <link rel="icon" href="/test/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Open+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className="antialiased"
        style={{ fontFamily: "'Open Sans', sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
