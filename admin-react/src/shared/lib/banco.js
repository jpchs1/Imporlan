/**
 * Cuentas de Imporlan para transferencias (Global66, desde oct-2026; antes
 * Banco Santander). Es la única fuente en el panel: si cambian, se cambian
 * aquí. La web pública (/pago/ y el checkout de Importa tú mismo) las repite
 * en su HTML; test/datos-bancarios-tests.php revisa que no queden las viejas.
 */
export const CUENTA_CLP = {
  id: 'clp',
  moneda: 'CLP',
  etiqueta: 'Pesos (CLP)',
  resumen: 'Global66 · cuenta vista en pesos',
  filas: [
    { label: 'Banco', value: 'Global66 / Global Card S.A.' },
    { label: 'Titular', value: 'Imporlan SpA' },
    { label: 'RUT', value: '76.914.409-9', copy: '769144099' },
    { label: 'Cuenta vista', value: '11678410' },
    { label: 'Correo', value: 'contacto@imporlan.cl' },
  ],
};

export const CUENTA_USD = {
  id: 'usd',
  moneda: 'USD',
  etiqueta: 'Dólares (USD)',
  resumen: 'Community Federal Savings Bank · Nueva York',
  filas: [
    { label: 'Account holder', value: 'IMPORLAN SPA' },
    { label: 'Account number', value: '8336089772' },
    { label: 'Routing number', value: '026073150' },
    { label: 'SWIFT / BIC', value: 'CMFGUS33' },
    { label: 'Bank name', value: 'Community Federal Savings Bank' },
    { label: 'Bank address', value: '5 Penn Plaza, 14th Floor, New York, NY 10001, US' },
  ],
};

export const CUENTAS = [CUENTA_CLP, CUENTA_USD];
