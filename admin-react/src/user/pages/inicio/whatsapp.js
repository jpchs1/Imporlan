/** WhatsApp de Imporlan (atención a clientes). */
export const WHATSAPP_IMPORLAN = '+56 9 4021 1459';

/** URL de wa.me con un texto inicial opcional. */
export function whatsappUrl(texto) {
  return `https://wa.me/56940211459${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

/** El texto por defecto cuando el cliente pide ayuda con su cuenta. */
export const WA_AYUDA = whatsappUrl('Hola, necesito ayuda con mi cuenta de Imporlan');
