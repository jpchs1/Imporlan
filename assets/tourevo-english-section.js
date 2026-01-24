/**
 * TOUREVO English Pages Section
 * 
 * This script injects a premium section showcasing the 10 English pages
 * into the TOUREVO WordPress home page.
 * 
 * Usage: Load this script on the WordPress home page (tourevo.cl)
 * The section will be inserted before the footer automatically.
 * 
 * Configuration: Edit the ENGLISH_PAGES array below to modify content.
 */

(function() {
    'use strict';

    // Only run on the home page
    if (window.location.pathname !== '/' && window.location.pathname !== '/inicio/') {
        return;
    }

    // Configuration - Easy to edit titles and descriptions
    const ENGLISH_PAGES = [
        {
            url: 'https://tourevo.cl/en/',
            title: 'Home (EN)',
            description: 'Luxury private tours & tailor-made journeys in Chile.'
        },
        {
            url: 'https://tourevo.cl/en/private-tours-chile/',
            title: 'Private Tours Chile',
            description: 'Private, flexible itineraries with premium service.'
        },
        {
            url: 'https://tourevo.cl/en/luxury-travel-chile/',
            title: 'Luxury Travel Chile',
            description: 'High-end travel design from Atacama to Patagonia.'
        },
        {
            url: 'https://tourevo.cl/en/custom-tours-chile/',
            title: 'Custom Tours Chile',
            description: '100% tailor-made trips built around your interests.'
        },
        {
            url: 'https://tourevo.cl/en/destination-management-chile/',
            title: 'DMC Chile',
            description: 'Destination management for groups, companies and delegations.'
        },
        {
            url: 'https://tourevo.cl/en/tours/atacama-desert-private-tour/',
            title: 'Atacama Desert',
            description: 'Private Atacama experiences: desert, lagoons and stargazing.'
        },
        {
            url: 'https://tourevo.cl/en/tours/patagonia-private-tour/',
            title: 'Patagonia',
            description: 'Private Patagonia journeys: glaciers, peaks and wild landscapes.'
        },
        {
            url: 'https://tourevo.cl/en/tours/chilean-wine-private-tour/',
            title: 'Chilean Wine',
            description: 'Curated wine tours across Chile\'s best valleys.'
        },
        {
            url: 'https://tourevo.cl/en/tours/ski-experience-chile/',
            title: 'Ski Chile',
            description: 'Premium ski experiences in the Andes.'
        },
        {
            url: 'https://tourevo.cl/en/tours/lake-district-private-tour/',
            title: 'Lake District',
            description: 'Volcanoes, lakes and nature retreats in Southern Chile.'
        }
    ];

    // Section configuration
    const SECTION_CONFIG = {
        title: 'Explore TOUREVO in English',
        subtitle: 'Discover our luxury private tours and curated travel experiences across Chile.',
        ctaText: 'View page'
    };

    // Create and inject styles
    function injectStyles() {
        const styleId = 'tourevo-english-section-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            /* TOUREVO English Pages Section */
            .tourevo-english-section {
                background: linear-gradient(135deg, #fdf9f6 0%, #f8f4f0 100%);
                padding: 80px 0;
                border-top: 1px solid rgba(59, 113, 254, 0.1);
                border-bottom: 1px solid rgba(59, 113, 254, 0.1);
            }

            .tourevo-english-section .section-container {
                max-width: 1320px;
                margin: 0 auto;
                padding: 0 20px;
            }

            .tourevo-english-section .section-header {
                text-align: center;
                margin-bottom: 50px;
            }

            .tourevo-english-section .section-title {
                font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 36px;
                font-weight: 700;
                color: #1a1a1a;
                margin: 0 0 15px 0;
                line-height: 1.3;
            }

            .tourevo-english-section .section-subtitle {
                font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 18px;
                color: #697488;
                margin: 0;
                max-width: 600px;
                margin-left: auto;
                margin-right: auto;
                line-height: 1.6;
            }

            .tourevo-english-section .cards-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 24px;
            }

            .tourevo-english-section .page-card {
                background: #ffffff;
                border-radius: 12px;
                padding: 28px 24px;
                text-decoration: none;
                display: flex;
                flex-direction: column;
                transition: all 0.3s ease;
                box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
                border: 1px solid rgba(0, 0, 0, 0.04);
                position: relative;
                overflow: hidden;
            }

            .tourevo-english-section .page-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: linear-gradient(90deg, #3b71fe, #5b8eff);
                transform: scaleX(0);
                transition: transform 0.3s ease;
            }

            .tourevo-english-section .page-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 32px rgba(59, 113, 254, 0.15);
            }

            .tourevo-english-section .page-card:hover::before {
                transform: scaleX(1);
            }

            .tourevo-english-section .card-title {
                font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 17px;
                font-weight: 600;
                color: #1a1a1a;
                margin: 0 0 10px 0;
                line-height: 1.4;
            }

            .tourevo-english-section .card-description {
                font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                color: #697488;
                margin: 0 0 16px 0;
                line-height: 1.5;
                flex-grow: 1;
            }

            .tourevo-english-section .card-cta {
                font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                font-weight: 600;
                color: #3b71fe;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: gap 0.3s ease;
            }

            .tourevo-english-section .page-card:hover .card-cta {
                gap: 10px;
            }

            .tourevo-english-section .card-cta svg {
                width: 16px;
                height: 16px;
                transition: transform 0.3s ease;
            }

            .tourevo-english-section .page-card:hover .card-cta svg {
                transform: translateX(2px);
            }

            /* Tablet: 2-3 columns */
            @media (max-width: 1200px) {
                .tourevo-english-section .cards-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }

            @media (max-width: 900px) {
                .tourevo-english-section .cards-grid {
                    grid-template-columns: repeat(2, 1fr);
                }

                .tourevo-english-section .section-title {
                    font-size: 30px;
                }

                .tourevo-english-section {
                    padding: 60px 0;
                }
            }

            /* Mobile: 1 column */
            @media (max-width: 600px) {
                .tourevo-english-section .cards-grid {
                    grid-template-columns: 1fr;
                    gap: 16px;
                }

                .tourevo-english-section .section-title {
                    font-size: 26px;
                }

                .tourevo-english-section .section-subtitle {
                    font-size: 16px;
                }

                .tourevo-english-section .page-card {
                    padding: 24px 20px;
                }

                .tourevo-english-section {
                    padding: 50px 0;
                }

                .tourevo-english-section .section-header {
                    margin-bottom: 35px;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // Create the section HTML
    function createSectionHTML() {
        const cardsHTML = ENGLISH_PAGES.map(page => `
            <a href="${page.url}" class="page-card">
                <h3 class="card-title">${page.title}</h3>
                <p class="card-description">${page.description}</p>
                <span class="card-cta">
                    ${SECTION_CONFIG.ctaText}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </span>
            </a>
        `).join('');

        return `
            <section class="tourevo-english-section" id="tourevo-english-pages">
                <div class="section-container">
                    <div class="section-header">
                        <h2 class="section-title">${SECTION_CONFIG.title}</h2>
                        <p class="section-subtitle">${SECTION_CONFIG.subtitle}</p>
                    </div>
                    <div class="cards-grid">
                        ${cardsHTML}
                    </div>
                </div>
            </section>
        `;
    }

    // Find the best insertion point and inject the section
    function injectSection() {
        // Check if section already exists
        if (document.getElementById('tourevo-english-pages')) {
            return;
        }

        // Inject styles first
        injectStyles();

        // Create section element
        const sectionWrapper = document.createElement('div');
        sectionWrapper.innerHTML = createSectionHTML();
        const section = sectionWrapper.firstElementChild;

        // Find insertion point - before footer
        const footer = document.querySelector('footer');
        
        if (footer) {
            // Insert before footer
            footer.parentNode.insertBefore(section, footer);
        } else {
            // Fallback: append to body
            document.body.appendChild(section);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSection);
    } else {
        // DOM already loaded, run immediately
        injectSection();
    }

})();
