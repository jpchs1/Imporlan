/**
 * TOUREVO Hero Section Loader
 * 
 * This script loads the shared hero section HTML and injects page-specific content.
 * It enables reuse of the same hero component across multiple pages while allowing
 * customization of text content.
 * 
 * Usage:
 * 1. Include this script in your page
 * 2. Add a container element with id="hero-section-container"
 * 3. Set data attributes on the container for customization:
 *    - data-hero-title: Main heading text
 *    - data-hero-subtitle: Subtitle text
 *    - data-hero-image: Background image URL (optional)
 *    - data-lang: Language code for menu items (optional, defaults to 'en')
 * 
 * Example:
 * <div id="hero-section-container"
 *      data-hero-title="Private Tours in Chile"
 *      data-hero-subtitle="Your local partner for premium experiences">
 * </div>
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        partialPath: '/en/shared/hero-section.html',
        cssPath: '/en/shared/hero-section.css',
        flatpickrCss: 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
        flatpickrJs: 'https://cdn.jsdelivr.net/npm/flatpickr',
        containerId: 'hero-section-container',
        defaultImage: 'https://tourevo.cl/wp-content/uploads/2025/04/Patagonia-Torres-del-Paine-Chile.jpg'
    };

    // Menu translations
    const MENU_TRANSLATIONS = {
        en: {
            home: 'Home',
            about: 'About Us',
            tours: 'Tours',
            experiences: 'Experiences',
            cars: 'Cars',
            accommodations: 'Accommodations',
            location: 'Location',
            arrival: 'Arrival',
            departure: 'Departure',
            search: 'Search',
            selectDate: 'Select date',
            whereTraveling: 'Where are you traveling?'
        },
        es: {
            home: 'Inicio',
            about: 'Nosotros',
            tours: 'Tours',
            experiences: 'Experiencias',
            cars: 'Autos',
            accommodations: 'Alojamientos',
            location: 'Lugar',
            arrival: 'Llegada',
            departure: 'Salida',
            search: 'Buscar',
            selectDate: 'Coloca la fecha',
            whereTraveling: 'Donde vas a viajar?'
        },
        pt: {
            home: 'Inicio',
            about: 'Sobre Nos',
            tours: 'Tours',
            experiences: 'Experiencias',
            cars: 'Carros',
            accommodations: 'Alojamentos',
            location: 'Local',
            arrival: 'Chegada',
            departure: 'Partida',
            search: 'Buscar',
            selectDate: 'Selecione a data',
            whereTraveling: 'Para onde voce vai viajar?'
        }
    };

    /**
     * Load CSS file if not already loaded
     */
    function loadCSS() {
        if (document.querySelector(`link[href="${CONFIG.cssPath}"]`)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = CONFIG.cssPath;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }

    /**
     * Fetch the HTML partial
     */
    async function fetchPartial() {
        const response = await fetch(CONFIG.partialPath);
        if (!response.ok) {
            throw new Error(`Failed to load hero section: ${response.status}`);
        }
        return response.text();
    }

    /**
     * Apply customizations to the loaded HTML
     */
    function applyCustomizations(html, container) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Get customization data from container attributes
        const title = container.dataset.heroTitle;
        const subtitle = container.dataset.heroSubtitle;
        const image = container.dataset.heroImage || CONFIG.defaultImage;
        const lang = container.dataset.lang || 'en';

        // Apply title
        if (title) {
            const titleEl = doc.getElementById('hero-title');
            if (titleEl) titleEl.textContent = title;
        }

        // Apply subtitle
        if (subtitle) {
            const subtitleEl = doc.getElementById('hero-subtitle');
            if (subtitleEl) subtitleEl.textContent = subtitle;
        }

        // Apply background image
        const heroEl = doc.getElementById('st-hero');
        if (heroEl && image) {
            heroEl.style.backgroundImage = `url('${image}')`;
        }

        // Apply language translations
        const translations = MENU_TRANSLATIONS[lang] || MENU_TRANSLATIONS.en;
        applyTranslations(doc, translations);

        // Return the modified HTML
        return doc.body.innerHTML;
    }

    /**
     * Apply translations to menu and form elements
     */
    function applyTranslations(doc, translations) {
        // Update menu items
        const menuItems = doc.querySelectorAll('.st-main-menu li a');
        const menuKeys = ['home', 'about', 'tours', 'experiences', 'cars', 'accommodations'];
        
        menuItems.forEach((item, index) => {
            if (menuKeys[index] && translations[menuKeys[index]]) {
                item.textContent = translations[menuKeys[index]];
            }
        });

        // Update form labels
        const labels = doc.querySelectorAll('.st-search-field label');
        const labelKeys = ['location', 'arrival', 'departure'];
        
        labels.forEach((label, index) => {
            if (labelKeys[index] && translations[labelKeys[index]]) {
                label.textContent = translations[labelKeys[index]];
            }
        });

        // Update placeholders
        const locationInput = doc.querySelector('.st-search-field input[name="location_name"]');
        if (locationInput && translations.whereTraveling) {
            locationInput.placeholder = translations.whereTraveling;
        }

        const dateInputs = doc.querySelectorAll('.st-search-field input[readonly]');
        dateInputs.forEach(input => {
            if (translations.selectDate) {
                input.placeholder = translations.selectDate;
            }
        });

        // Update search button
        const searchBtn = doc.querySelector('.st-search-btn');
        if (searchBtn && translations.search) {
            searchBtn.textContent = translations.search;
        }
    }

    /**
     * Initialize the hero section
     */
    async function init() {
        const container = document.getElementById(CONFIG.containerId);
        
        if (!container) {
            console.warn('Hero section container not found');
            return;
        }

        try {
            // Load CSS first
            await loadCSS();

            // Fetch and customize the HTML
            const html = await fetchPartial();
            const customizedHtml = applyCustomizations(html, container);

            // Insert into container
            container.innerHTML = customizedHtml;

            // Initialize any interactive elements
            initializeInteractions();

            // Dispatch event for other scripts
            document.dispatchEvent(new CustomEvent('heroSectionLoaded'));

        } catch (error) {
            console.error('Error loading hero section:', error);
            // Fallback: show a simple error message or leave container empty
        }
    }

    /**
     * Load flatpickr library for date pickers
     */
    function loadFlatpickr() {
        return new Promise((resolve, reject) => {
            // Load CSS
            if (!document.querySelector(`link[href="${CONFIG.flatpickrCss}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = CONFIG.flatpickrCss;
                document.head.appendChild(link);
            }

            // Load JS if not already loaded
            if (window.flatpickr) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = CONFIG.flatpickrJs;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize date pickers for arrival/departure fields
     */
    function initializeDatePickers() {
        loadFlatpickr().then(() => {
            const startInput = document.querySelector('.st-search-form input[name="start"]');
            const endInput = document.querySelector('.st-search-form input[name="end"]');

            if (startInput && window.flatpickr) {
                flatpickr(startInput, {
                    dateFormat: 'Y-m-d',
                    minDate: 'today',
                    allowInput: false,
                    onChange: function(selectedDates) {
                        if (endInput && endInput._flatpickr) {
                            endInput._flatpickr.set('minDate', selectedDates[0]);
                        }
                    }
                });
            }

            if (endInput && window.flatpickr) {
                flatpickr(endInput, {
                    dateFormat: 'Y-m-d',
                    minDate: 'today',
                    allowInput: false
                });
            }
        }).catch(err => {
            console.warn('Could not load flatpickr:', err);
        });
    }

    /**
     * Initialize interactive elements (tabs, mobile menu, etc.)
     */
    function initializeInteractions() {
        // Tab switching
        const tabs = document.querySelectorAll('.st-search-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Mobile menu toggle
        const menuToggle = document.querySelector('.st-menu-toggle');
        const mainMenu = document.querySelector('.st-header-center');
        
        if (menuToggle && mainMenu) {
            menuToggle.addEventListener('click', function() {
                mainMenu.classList.toggle('mobile-open');
            });
        }

        // Initialize date pickers
        initializeDatePickers();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for manual initialization if needed
    window.TourevoHeroLoader = {
        init: init,
        CONFIG: CONFIG
    };

})();
