# Testing IMPORLAN Admin Panel

## Access
- **Test Admin Panel**: `https://www.imporlan.cl/panel-test/admin/`
- **Production Admin Panel**: `https://www.imporlan.cl/panel/admin/`
- No login credentials needed - the admin panel loads directly

## Navigation
- The admin panel is a SPA (Single Page App) with hash-based routing
- Expedientes detail: `#expedientes/{id}` (e.g., `#expedientes/11`)
- Add `?_cb=uniquestring` to force fresh page load and bypass cache
- Example: `https://www.imporlan.cl/panel-test/admin/?_cb=test123#expedientes/11`

## Important: Page Load Timing
- The admin panel first shows the **Dashboard** then the Expedientes module initializes
- After navigating to a URL with `#expedientes/{id}`, wait **5+ seconds** for the detail view to render
- The sidebar item "Expedientes" appears only after the JS module loads

## Test Expedientes
- **IMP-00011**: Plan Almirante (molinabarbato) - has 9 boat links, 1 report
- **IMP-00004**: Plan Fragata (Alberto Lathrop) - has 13 links, no reports
- **IMP-00003**: Plan Almirante Premium (Juan Pablo Chaparro) - has 7 links, no reports
- **IMP-00006**: Plan Capitan de Navio (Clases de Ski) - has 3 links, no reports

## User Panel
- **Test**: `https://www.imporlan.cl/panel-test/`
- Requires user login credentials (not available to Devin by default)
- Shopping cart and plan descriptions are in `panel/assets/shopping-cart.js`
- Can verify shopping cart content via curl on the JS file instead of UI testing

## API Testing
- Reports API: `https://www.imporlan.cl/api/reports_api.php`
- Plans API is embedded in `api/index.php`
- Most API endpoints require admin authentication
- Public endpoints can be tested directly with curl

## Recording Tests
- Start recording before navigating to admin panel
- Use `annotate_recording` at key test moments
- Capture screenshots of each badge/feature being tested
