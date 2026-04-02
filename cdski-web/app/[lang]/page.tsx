import { getDictionary, locales, type Locale } from "@/lib/dictionaries";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import WhyChooseUs from "@/components/WhyChooseUs";
import Pricing from "@/components/Pricing";
import HowToBook from "@/components/HowToBook";
import Gallery from "@/components/Gallery";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import WhatsAppWidget from "@/components/WhatsAppWidget";
import MobileBookingBar from "@/components/MobileBookingBar";

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (locales.includes(lang as Locale) ? lang : "es") as Locale;
  const dict = await getDictionary(locale);

  return (
    <>
      <Header dict={dict} lang={locale} />
      <main>
        <Hero dict={dict} />
        <Services dict={dict} lang={locale} />
        <WhyChooseUs dict={dict} />
        <Pricing dict={dict} lang={locale} />
        <HowToBook dict={dict} />
        <Gallery dict={dict} />
        <Testimonials dict={dict} />
        <FAQ dict={dict} />
        <Contact dict={dict} />
      </main>
      <Footer dict={dict} lang={locale} />
      <WhatsAppWidget dict={dict} />
      <MobileBookingBar dict={dict} />
    </>
  );
}
