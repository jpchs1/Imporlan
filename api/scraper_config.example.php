<?php
/**
 * Scraper Plan B Configuration
 * Copy this file to scraper_config.php and fill in your API keys.
 * 
 * Plan B activates automatically when the normal scraper fails to extract
 * enough data from a listing (e.g. Facebook Marketplace blocks the request).
 * 
 * Level 1: ScrapingBee - Renders the page with a headless browser
 * Level 2: Screenshot + OpenAI Vision - Takes a screenshot and uses AI to extract data
 */

return [
    // ScrapingBee - Headless browser rendering (https://www.scrapingbee.com)
    // Sign up for free: 1000 credits/month on the free tier
    // Used for Plan B Level 1: renders JavaScript-heavy pages with real browser
    'scrapingbee_api_key' => '',

    // OpenAI API Key (https://platform.openai.com/api-keys)
    // Used for Plan B Level 2: analyzes screenshots with GPT-4o Vision
    // Cost: ~$0.01-0.03 per image analysis
    'openai_api_key' => '',

    // Minimum number of missing fields to trigger Plan B (default: 3)
    // Key fields: image, title, make, model, year, hours, engine, price, location
    'plan_b_threshold' => 3,
];
