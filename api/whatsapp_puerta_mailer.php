<?php
/**
 * El correo a JP con un borrador de WhatsApp (ver whatsapp_puerta.php).
 * Usa el EmailService de siempre: mismo SMTP, misma casilla contacto@imporlan.cl
 * y el mismo registro de envíos.
 */
require_once __DIR__ . '/email_service.php';

class ImporlanWaMailer extends EmailService {
    public function mandar($to, $asunto, $html) {
        return $this->sendEmail($to, $asunto, $html, 'whatsapp_borrador');
    }
}
