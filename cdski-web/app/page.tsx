import { getDictionary } from "@/lib/dictionaries";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import WhyChooseUs from "@/components/WhyChooseUs";
import Pricing from "@/components/Pricing";
import HowToBook from "@/components/HowToBook";
import Gallery from "@/components/Gallery";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import Blog from "@/components/Blog";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import WhatsAppWidget from "@/components/WhatsAppWidget";
import MobileBookingBar from "@/components/MobileBookingBar";

export default async function RootPage() {
  const dict = await getDictionary("es");

  return (
    <>
      <Header dict={dict} lang="es" />
      <main>
        <Hero dict={dict} />
        <Services dict={dict} lang="es" />
        <WhyChooseUs dict={dict} />
        <Pricing dict={dict} lang="es" />
        <HowToBook dict={dict} />
        <Gallery dict={dict} />
        <Testimonials dict={dict} />
        <FAQ dict={dict} />
        <Blog dict={dict} lang="es" />
        <Contact dict={dict} />
      </main>
      <Footer dict={dict} lang="es" />
      <WhatsAppWidget dict={dict} />
      <MobileBookingBar dict={dict} />
    </>
  );
}
