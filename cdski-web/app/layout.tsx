import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clases de Ski y Snowboard en Chile | CDSKI — Valle Nevado, El Colorado, La Parva",
  description: "Clases de ski y snowboard para todos los niveles en Valle Nevado, El Colorado y La Parva. Instructores expertos, paquetes all-inclusive y experiencias guiadas en la nieve de los Andes chilenos.",
  keywords: "clases de ski Chile, clases snowboard Santiago, Valle Nevado clases, El Colorado ski, La Parva snowboard, escuela de esquí Chile",
  metadataBase: new URL("https://clasesdeski.cl"),
  alternates: {
    canonical: "/",
    languages: {
      es: "/es/",
      en: "/en/",
      "pt-BR": "/pt/",
    },
  },
  openGraph: {
    title: "Clases de Ski y Snowboard en Chile | CDSKI",
    description: "Clases de ski y snowboard para todos los niveles en Valle Nevado, El Colorado y La Parva.",
    url: "https://clasesdeski.cl",
    siteName: "CDSKI — Clases de Ski y Snowboard Chile",
    locale: "es_CL",
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "CDSKI - Clases de Ski Chile" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clases de Ski y Snowboard en Chile | CDSKI",
    description: "Clases de ski y snowboard para todos los niveles en los Andes chilenos.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="alternate" hrefLang="es" href="https://clasesdeski.cl/es/" />
        <link rel="alternate" hrefLang="en" href="https://clasesdeski.cl/en/" />
        <link rel="alternate" hrefLang="pt-BR" href="https://clasesdeski.cl/pt/" />
        <link rel="alternate" hrefLang="x-default" href="https://clasesdeski.cl/" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Open+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" style={{ fontFamily: "'Open Sans', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
