"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import { blogPosts, type BlogPost } from "@/lib/blog-data";
import type { Dictionary } from "@/lib/dictionaries";

type Lang = "es" | "en" | "pt";

function BlogModal({ post, lang, dict, onClose }: { post: BlogPost; lang: Lang; dict: Dictionary; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
      >
        <div className="relative h-56 overflow-hidden rounded-t-2xl">
          <img src={post.image} alt={post.title[lang]} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="absolute bottom-4 left-6 right-6">
            <span className="text-white/70 text-sm">{post.date}</span>
            <h3 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {post.title[lang]}
            </h3>
          </div>
        </div>
        <div
          className="p-6 sm:p-8 prose prose-slate prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content[lang] }}
        />
        <div className="px-6 pb-6">
          <a
            href="#contact"
            onClick={onClose}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-full text-sm transition-all"
          >
            {dict.nav.bookNow}
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Blog({ dict, lang }: { dict: Dictionary; lang: string }) {
  const l = (["es", "en", "pt"].includes(lang) ? lang : "es") as Lang;
  const [tab, setTab] = useState<"blog" | "explora">("blog");
  const [selected, setSelected] = useState<BlogPost | null>(null);

  const filtered = blogPosts.filter((p) => p.category === tab);

  return (
    <section id="blog" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-800 mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {dict.blog.title}
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">{dict.blog.subtitle}</p>
        </AnimatedSection>

        <AnimatedSection className="flex justify-center mb-10">
          <div className="inline-flex bg-slate-100 rounded-full p-1">
            <button
              onClick={() => setTab("blog")}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                tab === "blog" ? "bg-orange-500 text-white shadow" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Blog
            </button>
            <button
              onClick={() => setTab("explora")}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                tab === "explora" ? "bg-orange-500 text-white shadow" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Explora CDSKI
            </button>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((post, i) => (
            <AnimatedSection key={post.slug} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                onClick={() => setSelected(post)}
                className="group cursor-pointer bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-orange-300 hover:shadow-xl transition-all duration-300 shadow-md h-full flex flex-col"
              >
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title[l]}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className="bg-white/90 backdrop-blur-sm text-slate-600 text-xs font-medium px-3 py-1 rounded-full">
                      {post.date}
                    </span>
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-grow">
                  <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-2 group-hover:text-orange-500 transition-colors" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    {post.title[l]}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-4 flex-grow line-clamp-3">
                    {post.excerpt[l]}
                  </p>
                  <span className="inline-flex items-center gap-1 text-orange-500 font-semibold text-sm group-hover:gap-2 transition-all">
                    {dict.blog.readMore}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </div>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <BlogModal post={selected} lang={l} dict={dict} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}
