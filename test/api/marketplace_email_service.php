<?php
/**
 * Marketplace Email Service - Imporlan
 * Automated email system for boat marketplace listings
 * 
 * Extends EmailService to reuse base templates, SMTP infrastructure, and design tokens.
 * All templates match EXACTLY the existing Imporlan email style.
 * 
 * Environment variables (provision via cPanel / GitHub Secrets):
 *   IMPORLAN_BASE_URL        - Base URL (default: https://www.imporlan.cl)
 *   MARKETPLACE_CRON_KEY     - Secret key for HTTP-triggered cron
 * 
 * @version 1.0
 */

require_once __DIR__ . '/email_service.php';

class MarketplaceEmailService extends EmailService {

    private $marketplaceBaseUrl;
    private $adminBaseUrl;
    private $siteBaseUrl;

    public function __construct() {
        parent::__construct();
        $this->siteBaseUrl = getenv('IMPORLAN_BASE_URL') ?: 'https://www.imporlan.cl';
        $isTest = $this->isTestEnvironment;
        $this->marketplaceBaseUrl = $isTest
            ? $this->siteBaseUrl . '/panel-test'
            : $this->siteBaseUrl . '/panel';
        $this->adminBaseUrl = $isTest
            ? $this->siteBaseUrl . '/panel-test/admin'
            : $this->siteBaseUrl . '/panel/admin';
    }

    // =========================================================
    //  URL BUILDERS
    // =========================================================

    private function getViewListingUrl($listingId) {
        return $this->marketplaceBaseUrl . '/#/marketplace/' . intval($listingId);
    }

    private function getEditListingUrl($listingId) {
        return $this->marketplaceBaseUrl . '/#/marketplace/editar/' . intval($listingId);
    }

    private function getRenewListingUrl($listingId) {
        return $this->marketplaceBaseUrl . '/#/marketplace/renovar/' . intval($listingId);
    }

    private function getNewListingUrl() {
        return $this->marketplaceBaseUrl . '/#/marketplace/publicar';
    }

    private function getAdminViewListingUrl($listingId) {
        return $this->adminBaseUrl . '/#/marketplace/' . intval($listingId);
    }

    // =========================================================
    //  LISTING CARD COMPONENT
    // =========================================================

    protected function getListingCard($listing) {
        $c = $this->colors;
        $nombre   = htmlspecialchars($listing['nombre'] ?? 'Sin nombre');
        $tipo     = htmlspecialchars($listing['tipo'] ?? '');
        $ano      = $listing['ano'] ?? '';
        $ubicacion = htmlspecialchars($listing['ubicacion'] ?? '');
        $precio   = $this->formatPrice($listing['precio'] ?? 0, $listing['moneda'] ?? 'USD');

        $metaParts = array_filter([$tipo, $ano, $ubicacion]);
        $metaLine  = implode(' &middot; ', array_map('htmlspecialchars', $metaParts));

        $fotos = $listing['fotos'] ?? [];
        if (is_string($fotos)) {
            $fotos = json_decode($fotos, true) ?: [];
        }
        $imageUrl = !empty($fotos[0]) ? $this->absoluteImageUrl($fotos[0]) : '';

        $imageHtml = '';
        if ($imageUrl) {
            $imageHtml = '
            <td width="140" valign="top" style="padding: 0;">
                <img src="' . htmlspecialchars($imageUrl) . '" width="140" height="105"
                     style="display: block; object-fit: cover; border-radius: 8px 0 0 8px;"
                     alt="' . $nombre . '">
            </td>';
        }

        return '
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                      border-radius: 12px; margin: 20px 0; overflow: hidden;
                      border-left: 4px solid ' . $c['primary'] . ';">
            <tr>
                ' . $imageHtml . '
                <td style="padding: 16px 20px;" valign="middle">
                    <p style="margin: 0 0 6px; font-size: 17px; font-weight: 600; color: ' . $c['text_dark'] . ';">
                        ' . $nombre . '
                    </p>
                    ' . ($metaLine ? '<p style="margin: 0 0 8px; font-size: 13px; color: ' . $c['text_muted'] . ';">' . $metaLine . '</p>' : '') . '
                    <p style="margin: 0; font-size: 18px; font-weight: 700; color: ' . $c['primary'] . ';">
                        ' . $precio . '
                    </p>
                </td>
            </tr>
        </table>';
    }

    // =========================================================
    //  HELPERS
    // =========================================================

    private function formatPrice($precio, $moneda) {
        $formatted = number_format((float)$precio, 0, ',', '.');
        return ($moneda === 'CLP')
            ? '$' . $formatted . ' CLP'
            : 'USD $' . $formatted;
    }

    private function absoluteImageUrl($url) {
        if (!$url) return '';
        if (strpos($url, 'http') === 0) return $url;
        return $this->siteBaseUrl . $url;
    }

    private function fmtDate($d) {
        return $d ? date('d/m/Y', strtotime($d)) : 'N/A';
    }

    private function fmtDateTime($d) {
        return $d ? date('d/m/Y H:i', strtotime($d)) : 'N/A';
    }

    // =========================================================
    //  USER EMAILS (11 types)
    // =========================================================

    /** 1. Listing created */
    public function sendListingCreatedEmail($userEmail, $userName, $listing) {
        $c = $this->colors;
        $subject = 'Recibimos tu anuncio';
        $content = '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge('success', 'Anuncio creado') . '
            </div>
            <h2 style="margin:0 0 8px;color:' . $c['text_dark'] . ';font-size:24px;font-weight:600;text-align:center;">
                Recibimos tu anuncio
            </h2>
            <p style="margin:0 0 25px;color:' . $c['text_muted'] . ';font-size:14px;text-align:center;">
                Hola ' . htmlspecialchars($userName) . ', tu anuncio ha sido registrado exitosamente en Imporlan.
            </p>
            ' . $this->getListingCard($listing) . '
            ' . $this->getInfoCard('Detalles', [
                'Estado' => 'Publicado',
                'Fecha publicacion' => $this->fmtDate($listing['published_at'] ?? $listing['created_at'] ?? date('Y-m-d')),
                'Vence el' => $this->fmtDate($listing['expires_at'] ?? ''),
            ]) . '
            <div style="margin:30px 0;">
                ' . $this->getButton('Ver anuncio', $this->getViewListingUrl($listing['id'])) . '
            </div>
            <p style="margin:25px 0 0;color:' . $c['text_muted'] . ';font-size:13px;text-align:center;">
                Tu anuncio estara visible durante 30 dias. Te enviaremos recordatorios antes del vencimiento.
            </p>';
        $html = $this->getBaseTemplate($content, $subject);
        return $this->sendEmail($userEmail, $subject, $html, 'listing_created', [
            'listing_id' => $listing['id'], 'listing_name' => $listing['nombre']
        ]);
    }

    /** 2. Sent for review */
    public function sendListingPendingReviewEmail($userEmail, $userName, $listing) {
        $c = $this->colors;
        $subject = 'Tu anuncio esta en revision';
        $content = '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge('info', 'En revision') . '
            </div>
            <h2 style="margin:0 0 8px;color:' . $c['text_dark'] . ';font-size:24px;font-weight:600;text-align:center;">
                Tu anuncio esta en revision
            </h2>
            <p style="margin:0 0 25px;color:' . $c['text_muted'] . ';font-size:14px;text-align:center;">
                Hola ' . htmlspecialchars($userName) . ', nuestro equipo esta revisando tu anuncio.
            </p>
            ' . $this->getListingCard($listing) . '
            <p style="margin:20px 0;color:' . $c['text_dark'] . ';font-size:15px;line-height:1.6;">
                Te notificaremos por email cuando tu anuncio sea aprobado. El tiempo estimado de revision es de <strong>24 a 48 horas habiles</strong>.
            </p>
            <p style="margin:25px 0 0;color:' . $c['text_muted'] . ';font-size:13px;text-align:center;">
                Si tienes alguna pregunta, contactanos a <a href="mailto:contacto@imporlan.cl" style="color:' . $c['primary'] . ';text-decoration:none;">contacto@imporlan.cl</a>
            </p>';
        $html = $this->getBaseTemplate($content, $subject);
        return $this->sendEmail($userEmail, $subject, $html, 'listing_pending_review', [
            'listing_id' => $listing['id'], 'listing_name' => $listing['nombre']
        ]);
    }

    /** 3. Approved and published */
    public function sendListingPublishedEmail($userEmail, $userName, $listing) {
        $c = $this->colors;
        $subject = 'Tu anuncio ya esta publicado en Imporlan';
        $content = '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge('success', 'Publicado') . '
            </div>
            <h2 style="margin:0 0 8px;color:' . $c['text_dark'] . ';font-size:24px;font-weight:600;text-align:center;">
                Tu anuncio esta publicado
            </h2>
            <p style="margin:0 0 25px;color:' . $c['text_muted'] . ';font-size:14px;text-align:center;">
                Hola ' . htmlspecialchars($userName) . ', tu embarcacion ya es visible para todos los visitantes de Imporlan.
            </p>
            ' . $this->getListingCard($listing) . '
            ' . $this->getInfoCard('Fechas importantes', [
                'Publicado el' => $this->fmtDate($listing['published_at'] ?? ''),
                'Vence el' => $this->fmtDate($listing['expires_at'] ?? ''),
            ]) . '
            <div style="margin:30px 0;">
                ' . $this->getButton('Ver anuncio', $this->getViewListingUrl($listing['id'])) . '
            </div>
            <p style="margin:25px 0 0;color:' . $c['text_muted'] . ';font-size:13px;text-align:center;">
                Recibiras recordatorios antes de que tu anuncio expire.
            </p>';
        $html = $this->getBaseTemplate($content, $subject);
        return $this->sendEmail($userEmail, $subject, $html, 'listing_published', [
            'listing_id' => $listing['id'], 'listing_name' => $listing['nombre']
        ]);
    }

    /** 4. Rejected */
    public function sendListingRejectedEmail($userEmail, $userName, $listing, $reasons = []) {
        $c = $this->colors;
        $subject = 'Tu anuncio necesita ajustes para publicarse';

        $reasonsHtml = '';
        if (!empty($reasons)) {
            $reasonsHtml = '<ul style="margin:15px 0;padding-left:20px;">';
            foreach ($reasons as $r) {
                $reasonsHtml .= '<li style="color:' . $c['text_dark'] . ';font-size:14px;margin-bottom:8px;">' . htmlspecialchars($r) . '</li>';
            }
            $reasonsHtml .= '</ul>';
        }

        $content = '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge('error', 'Requiere ajustes') . '
            </div>
            <h2 style="margin:0 0 8px;color:' . $c['text_dark'] . ';font-size:24px;font-weight:600;text-align:center;">
                Tu anuncio necesita ajustes
            </h2>
            <p style="margin:0 0 25px;color:' . $c['text_muted'] . ';font-size:14px;text-align:center;">
                Hola ' . htmlspecialchars($userName) . ', hemos revisado tu anuncio y necesita algunos cambios para poder publicarse.
            </p>
            ' . $this->getListingCard($listing) . '
            ' . $reasonsHtml . '
            <div style="margin:30px 0;">
                ' . $this->getButton('Editar anuncio', $this->getEditListingUrl($listing['id'])) . '
            </div>
            <p style="margin:25px 0 0;color:' . $c['text_muted'] . ';font-size:13px;text-align:center;">
                Una vez que realices los ajustes, tu anuncio sera revisado nuevamente.
            </p>';
        $html = $this->getBaseTemplate($content, $subject);
        return $this->sendEmail($userEmail, $subject, $html, 'listing_rejected', [
            'listing_id' => $listing['id'], 'listing_name' => $listing['nombre'], 'reasons' => $reasons
        ]);
    }

    /** 5. Edited */
    public function sendListingEditedEmail($userEmail, $userName, $listing) {
        $c = $this->colors;
        $subject = 'Cambios guardados en tu anuncio';
        $content = '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge('success', 'Actualizado') . '
            </div>
            <h2 style="margin:0 0 8px;color:' . $c['text_dark'] . ';font-size:24px;font-weight:600;text-align:center;">
                Cambios guardados
            </h2>
            <p style="margin:0 0 25px;color:' . $c['text_muted'] . ';font-size:14px;text-align:center;">
                Hola ' . htmlspecialchars($userName) . ', los cambios en tu anuncio fueron guardados correctamente.
            </p>
            ' . $this->getListingCard($listing) . '
            <div style="margin:30px 0;">
                ' . $this->getButton('Ver anuncio', $this->getViewListingUrl($listing['id'])) . '
            </div>';
        $html = $this->getBaseTemplate($content, $subject);
        return $this->sendEmail($userEmail, $subject, $html, 'listing_edited', [
            'listing_id' => $listing['id'], 'listing_name' => $listing['nombre']
        ]);
    }

    /** 6. Paused */
    public function sendListingPausedEmail($userEmail, $userName, $listing) {
        $c = $this->colors;
        $subject = 'Tu anuncio fue pausado';
        $content = '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge('warning', 'Pausado') . '
            </div>
            <h2 style="margin:0 0 8px;color:' . $c['text_dark'] . ';font-size:24px;font-weight:600;text-align:center;">
                Tu anuncio fue pausado
            </h2>
            <p style="margin:0 0 25px;color:' . $c['text_muted'] . ';font-size:14px;text-align:center;">
                Hola ' . htmlspecialchars($userName) . ', tu anuncio ha sido pausado y ya no es visible para otros usuarios.
            </p>
            ' . $this->getListingCard($listing) . '
            <div style="margin:30px 0;">
                ' . $this->getButton('Reactivar anuncio', $this->getViewListingUrl($listing['id'])) . '
            </div>
            <p style="margin:25px 0 0;color:' . $c['text_muted'] . ';font-size:13px;text-align:center;">
                Puedes reactivar tu anuncio en cualquier momento desde tu panel.
            </p>';
        $html = $this->getBaseTemplate($content, $subject);
        return $this->sendEmail($userEmail, $subject, $html, 'listing_paused', [
            'listing_id' => $listing['id'], 'listing_name' => $listing['nombre']
        ]);
    }

    /** 7. Marked as sold */
    public function sendListingSoldEmail($userEmail, $userName, $listing) {
        $c = $this->colors;
        $subject = 'Anuncio marcado como vendido';
        $content = '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge('success', 'Vendido') . '
            </div>
            <h2 style="margin:0 0 8px;color:' . $c['text_dark'] . ';font-size:24px;font-weight:600;text-align:center;">
                Felicidades por tu venta
            </h2>
            <p style="margin:0 0 25px;color:' . $c['text_muted'] . ';font-size:14px;text-align:center;">
                Hola ' . htmlspecialchars($userName) . ', tu embarcacion fue marcada como vendida en Imporlan.
            </p>
            ' . $this->getListingCard($listing) . '
            <div style="margin:30px 0;">
                ' . $this->getButton('Ver anuncio', $this->getViewListingUrl($listing['id'])) . '
            </div>
            <p style="margin:25px 0 0;color:' . $c['text_muted'] . ';font-size:13px;text-align:center;">
                Gracias por usar Imporlan. Esperamos verte de nuevo pronto.
            </p>';
        $html = $this->getBaseTemplate($content, $subject);
        return $this->sendEmail($userEmail, $subject, $html, 'listing_sold', [
            'listing_id' => $listing['id'], 'listing_name' => $listing['nombre']
        ]);
    }

    /** 8. Manually deleted */
    public function sendListingDeletedEmail($userEmail, $userName, $listing) {
        $c = $this->colors;
        $subject = 'Tu anuncio fue eliminado';
        $content = '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge('info', 'Eliminado') . '
            </div>
            <h2 style="margin:0 0 8px;color:' . $c['text_dark'] . ';font-size:24px;font-weight:600;text-align:center;">
                Anuncio eliminado
            </h2>
            <p style="margin:0 0 25px;color:' . $c['text_muted'] . ';font-size:14px;text-align:center;">
                Hola ' . htmlspecialchars($userName) . ', tu anuncio ha sido eliminado de Imporlan.
            </p>
            ' . $this->getListingCard($listing) . '
            <div style="margin:30px 0;">
                ' . $this->getButton('Publicar nuevo anuncio', $this->getNewListingUrl()) . '
            </div>';
        $html = $this->getBaseTemplate($content, $subject);
        return $this->sendEmail($userEmail, $subject, $html, 'listing_deleted', [
            'listing_id' => $listing['id'], 'listing_name' => $listing['nombre']
        ]);
    }

    /** 9. Expiration reminder (D-7 to D-1) */
    public function sendListingExpiryReminderEmail($userEmail, $userName, $listing, $daysRemaining) {
        $c = $this->colors;
        $days = intval($daysRemaining);
        $subject = 'Tu anuncio vence en ' . $days . ' dia' . ($days !== 1 ? 's' : '') . ' — Deseas renovarlo?';
        $expiresDate = $this->fmtDate($listing['expires_at'] ?? '');

        $urgencyColor = $days <= 2 ? $c['error'] : $c['warning'];

        $content = '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge($days <= 2 ? 'error' : 'warning', 'Vence en ' . $days . ' dia' . ($days !== 1 ? 's' : '')) . '
            </div>
            <h2 style="margin:0 0 8px;color:' . $c['text_dark'] . ';font-size:24px;font-weight:600;text-align:center;">
                Tu anuncio esta por vencer
            </h2>
            <p style="margin:0 0 25px;color:' . $c['text_muted'] . ';font-size:14px;text-align:center;">
                Hola ' . htmlspecialchars($userName) . ', tu anuncio vence el <strong style="color:' . $urgencyColor . ';">' . $expiresDate . '</strong>.
            </p>
            ' . $this->getListingCard($listing) . '
            <p style="margin:20px 0;color:' . $c['text_dark'] . ';font-size:15px;line-height:1.6;text-align:center;">
                Si no renuevas, tu anuncio se eliminara automaticamente el <strong>' . $expiresDate . '</strong>.
            </p>
            <div style="margin:30px 0;">
                ' . $this->getButton('Renovar anuncio (30 dias)', $this->getRenewListingUrl($listing['id'])) . '
            </div>
            <div style="margin:15px 0;text-align:center;">
                ' . $this->getSecondaryButton('Ver anuncio', $this->getViewListingUrl($listing['id'])) . '
            </div>';
        $html = $this->getBaseTemplate($content, $subject);
        return $this->sendEmail($userEmail, $subject, $html, 'listing_expiry_reminder', [
            'listing_id' => $listing['id'], 'listing_name' => $listing['nombre'],
            'days_remaining' => $days
        ]);
    }

    /** 10. Renewed */
    public function sendListingRenewedEmail($userEmail, $userName, $listing) {
        $c = $this->colors;
        $subject = 'Tu anuncio fue renovado por 30 dias';
        $content = '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge('success', 'Renovado') . '
            </div>
            <h2 style="margin:0 0 8px;color:' . $c['text_dark'] . ';font-size:24px;font-weight:600;text-align:center;">
                Anuncio renovado exitosamente
            </h2>
            <p style="margin:0 0 25px;color:' . $c['text_muted'] . ';font-size:14px;text-align:center;">
                Hola ' . htmlspecialchars($userName) . ', tu anuncio seguira visible por 30 dias mas.
            </p>
            ' . $this->getListingCard($listing) . '
            ' . $this->getInfoCard('Nueva vigencia', [
                'Renovado el' => $this->fmtDate(date('Y-m-d')),
                'Nuevo vencimiento' => $this->fmtDate($listing['expires_at'] ?? ''),
            ]) . '
            <div style="margin:30px 0;">
                ' . $this->getButton('Ver anuncio', $this->getViewListingUrl($listing['id'])) . '
            </div>';
        $html = $this->getBaseTemplate($content, $subject);
        return $this->sendEmail($userEmail, $subject, $html, 'listing_renewed', [
            'listing_id' => $listing['id'], 'listing_name' => $listing['nombre']
        ]);
    }

    /** 11. Auto-expired */
    public function sendListingExpiredEmail($userEmail, $userName, $listing) {
        $c = $this->colors;
        $subject = 'Tu anuncio expiro';
        $content = '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge('error', 'Expirado') . '
            </div>
            <h2 style="margin:0 0 8px;color:' . $c['text_dark'] . ';font-size:24px;font-weight:600;text-align:center;">
                Tu anuncio ha expirado
            </h2>
            <p style="margin:0 0 25px;color:' . $c['text_muted'] . ';font-size:14px;text-align:center;">
                Hola ' . htmlspecialchars($userName) . ', tu anuncio fue retirado de Imporlan por vencimiento del plazo de 30 dias.
            </p>
            ' . $this->getListingCard($listing) . '
            <p style="margin:20px 0;color:' . $c['text_dark'] . ';font-size:15px;line-height:1.6;text-align:center;">
                Si deseas volver a publicar tu embarcacion, puedes crear un nuevo anuncio en cualquier momento.
            </p>
            <div style="margin:30px 0;">
                ' . $this->getButton('Publicar nuevo anuncio', $this->getNewListingUrl()) . '
            </div>';
        $html = $this->getBaseTemplate($content, $subject);
        return $this->sendEmail($userEmail, $subject, $html, 'listing_expired', [
            'listing_id' => $listing['id'], 'listing_name' => $listing['nombre']
        ]);
    }

    // =========================================================
    //  ADMIN EMAILS (8 types)
    // =========================================================

    private function sendAdminEmail($subject, $content, $templateKey, $metadata) {
        $html = $this->getBaseTemplate($content, $subject . ' - Admin');
        $results = [];
        foreach ($this->adminEmails as $adminEmail) {
            $results[] = $this->sendEmail($adminEmail, $subject, $html, $templateKey, $metadata);
        }
        return ['success' => true, 'results' => $results];
    }

    private function adminListingSummary($listing) {
        return [
            'Embarcacion' => $listing['nombre'] ?? 'N/A',
            'Tipo' => $listing['tipo'] ?? 'N/A',
            'Precio' => $this->formatPrice($listing['precio'] ?? 0, $listing['moneda'] ?? 'USD'),
            'Usuario' => $listing['user_name'] ?? 'N/A',
            'Email' => $listing['user_email'] ?? 'N/A',
            'Fecha/Hora' => $this->fmtDateTime(date('Y-m-d H:i:s')),
        ];
    }

    private function adminContent($badgeType, $badgeText, $title, $listing, $extraItems = [], $extraHtml = '') {
        $c = $this->colors;
        $items = $this->adminListingSummary($listing);
        if ($extraItems) {
            $items = array_merge($items, $extraItems);
        }
        return '
            <div style="text-align:center;margin-bottom:25px;">
                ' . $this->getStatusBadge($badgeType, $badgeText) . '
            </div>
            <h2 style="margin:0 0 25px;color:' . $c['text_dark'] . ';font-size:20px;font-weight:600;text-align:center;">
                ' . htmlspecialchars($title) . '
            </h2>
            ' . $this->getListingCard($listing) . '
            ' . $this->getInfoCard('Detalles del anuncio', $items) . '
            ' . $extraHtml . '
            <div style="margin:30px 0;text-align:center;">
                ' . $this->getButton('Ver en admin', $this->getAdminViewListingUrl($listing['id'] ?? 0)) . '
            </div>
            <p style="margin:20px 0 0;color:' . $c['text_muted'] . ';font-size:13px;text-align:center;">
                Notificacion automatica del sistema Marketplace
            </p>';
    }

    /** A. New listing created */
    public function sendAdminListingCreatedEmail($listing) {
        $content = $this->adminContent('success', 'Nuevo anuncio', 'Nuevo anuncio creado', $listing);
        return $this->sendAdminEmail('Nuevo anuncio creado en Marketplace', $content, 'admin_listing_created', [
            'listing_id' => $listing['id']
        ]);
    }

    /** B. Sent for review */
    public function sendAdminListingPendingReviewEmail($listing) {
        $content = $this->adminContent('info', 'En revision', 'Anuncio enviado a revision', $listing);
        return $this->sendAdminEmail('Anuncio enviado a revision', $content, 'admin_listing_pending_review', [
            'listing_id' => $listing['id']
        ]);
    }

    /** C. Published */
    public function sendAdminListingPublishedEmail($listing) {
        $extra = [
            'Publicado el' => $this->fmtDate($listing['published_at'] ?? ''),
            'Vence el' => $this->fmtDate($listing['expires_at'] ?? ''),
        ];
        $content = $this->adminContent('success', 'Publicado', 'Anuncio publicado', $listing, $extra);
        return $this->sendAdminEmail('Anuncio publicado en Marketplace', $content, 'admin_listing_published', [
            'listing_id' => $listing['id']
        ]);
    }

    /** D. Edited by user */
    public function sendAdminListingEditedEmail($listing) {
        $content = $this->adminContent('info', 'Editado', 'Anuncio editado por usuario', $listing);
        return $this->sendAdminEmail('Anuncio editado por usuario', $content, 'admin_listing_edited', [
            'listing_id' => $listing['id']
        ]);
    }

    /** E. Rejected */
    public function sendAdminListingRejectedEmail($listing, $reasons = []) {
        $c = $this->colors;
        $reasonsHtml = '';
        if (!empty($reasons)) {
            $reasonsHtml = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background:#fff7ed;border-radius:12px;margin:20px 0;border-left:4px solid ' . $c['warning'] . ';">
                <tr><td style="padding:20px;">
                    <h3 style="margin:0 0 10px;color:' . $c['text_dark'] . ';font-size:15px;font-weight:600;">Motivos del rechazo</h3>
                    <ul style="margin:0;padding-left:20px;">';
            foreach ($reasons as $r) {
                $reasonsHtml .= '<li style="color:' . $c['text_dark'] . ';font-size:14px;margin-bottom:6px;">' . htmlspecialchars($r) . '</li>';
            }
            $reasonsHtml .= '</ul></td></tr></table>';
        }
        $content = $this->adminContent('error', 'Rechazado', 'Anuncio rechazado', $listing, [], $reasonsHtml);
        return $this->sendAdminEmail('Anuncio rechazado', $content, 'admin_listing_rejected', [
            'listing_id' => $listing['id'], 'reasons' => $reasons
        ]);
    }

    /** F. Marked as sold */
    public function sendAdminListingSoldEmail($listing) {
        $content = $this->adminContent('success', 'Vendido', 'Anuncio marcado como vendido', $listing);
        return $this->sendAdminEmail('Anuncio marcado como vendido', $content, 'admin_listing_sold', [
            'listing_id' => $listing['id']
        ]);
    }

    /** G-bis. Renewed */
    public function sendAdminListingRenewedEmail($listing) {
        $extra = [
            'Renovado el' => $this->fmtDate(date('Y-m-d')),
            'Nuevo vencimiento' => $this->fmtDate($listing['expires_at'] ?? ''),
        ];
        $content = $this->adminContent('success', 'Renovado', 'Anuncio renovado por usuario', $listing, $extra);
        return $this->sendAdminEmail('Anuncio renovado por usuario', $content, 'admin_listing_renewed', [
            'listing_id' => $listing['id']
        ]);
    }

    /** G. Manually deleted by user */
    public function sendAdminListingDeletedEmail($listing) {
        $content = $this->adminContent('warning', 'Eliminado', 'Anuncio eliminado por usuario', $listing);
        return $this->sendAdminEmail('Anuncio eliminado por usuario', $content, 'admin_listing_deleted', [
            'listing_id' => $listing['id']
        ]);
    }

    /** H. Auto-expired */
    public function sendAdminListingExpiredEmail($listing) {
        $extra = [
            'Publicado el' => $this->fmtDate($listing['published_at'] ?? ''),
            'Vencio el' => $this->fmtDate($listing['expires_at'] ?? ''),
        ];
        $content = $this->adminContent('error', 'Expirado', 'Anuncio expirado automaticamente', $listing, $extra);
        return $this->sendAdminEmail('Anuncio expirado automaticamente', $content, 'admin_listing_expired', [
            'listing_id' => $listing['id']
        ]);
    }

    // =========================================================
    //  IDEMPOTENCY (prevent duplicate sends)
    // =========================================================

    public function hasBeenSent($listingId, $templateKey, $date = null) {
        if (!$this->pdo) return false;
        $date = $date ?: date('Y-m-d');
        try {
            $this->ensureMarketplaceEmailSentTable();
            $stmt = $this->pdo->prepare(
                "SELECT COUNT(*) FROM marketplace_email_sent WHERE listing_id = ? AND template_key = ? AND sent_date = ?"
            );
            $stmt->execute([$listingId, $templateKey, $date]);
            return (int)$stmt->fetchColumn() > 0;
        } catch (PDOException $e) {
            error_log("[MarketplaceEmail] Idempotency check error: " . $e->getMessage());
            return false;
        }
    }

    public function markAsSent($listingId, $templateKey, $date = null) {
        if (!$this->pdo) return;
        $date = $date ?: date('Y-m-d');
        try {
            $this->ensureMarketplaceEmailSentTable();
            $stmt = $this->pdo->prepare(
                "INSERT IGNORE INTO marketplace_email_sent (listing_id, template_key, sent_date) VALUES (?, ?, ?)"
            );
            $stmt->execute([$listingId, $templateKey, $date]);
        } catch (PDOException $e) {
            error_log("[MarketplaceEmail] Mark as sent error: " . $e->getMessage());
        }
    }

    private function ensureMarketplaceEmailSentTable() {
        static $checked = false;
        if ($checked) return;
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS marketplace_email_sent (
                id INT AUTO_INCREMENT PRIMARY KEY,
                listing_id INT NOT NULL,
                template_key VARCHAR(100) NOT NULL,
                sent_date DATE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_idempotency (listing_id, template_key, sent_date),
                INDEX idx_listing (listing_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $checked = true;
    }

    // =========================================================
    //  DB MIGRATION (add marketplace columns)
    // =========================================================

    public function migrateMarketplaceSchema() {
        if (!$this->pdo) return ['error' => 'No DB connection'];
        $results = [];

        try {
            $cols = $this->pdo->query("SHOW COLUMNS FROM marketplace_listings")->fetchAll(PDO::FETCH_COLUMN);

            if (!in_array('published_at', $cols)) {
                $this->pdo->exec("ALTER TABLE marketplace_listings ADD COLUMN published_at DATETIME DEFAULT NULL AFTER status");
                $results[] = 'Added published_at column';
            }

            if (!in_array('expires_at', $cols)) {
                $this->pdo->exec("ALTER TABLE marketplace_listings ADD COLUMN expires_at DATETIME DEFAULT NULL AFTER published_at");
                $this->pdo->exec("ALTER TABLE marketplace_listings ADD INDEX idx_expires (expires_at)");
                $results[] = 'Added expires_at column + index';
            }

            $this->pdo->exec("
                ALTER TABLE marketplace_listings
                MODIFY COLUMN status ENUM('active','sold','deleted','expired') DEFAULT 'active'
            ");
            $results[] = 'Expanded status enum to include expired';

            $this->pdo->exec("
                UPDATE marketplace_listings
                SET published_at = created_at,
                    expires_at = DATE_ADD(created_at, INTERVAL 30 DAY)
                WHERE published_at IS NULL AND status = 'active'
            ");
            $results[] = 'Backfilled published_at/expires_at for existing active listings';

            $this->ensureMarketplaceEmailSentTable();
            $results[] = 'Ensured marketplace_email_sent table exists';

        } catch (PDOException $e) {
            $results[] = 'Error: ' . $e->getMessage();
        }

        return ['success' => true, 'migrations' => $results];
    }

    public function ensureMigrated() {
        static $done = false;
        if ($done) return;
        try {
            $cols = $this->pdo->query("SHOW COLUMNS FROM marketplace_listings")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('published_at', $cols) || !in_array('expires_at', $cols)) {
                $this->migrateMarketplaceSchema();
            }
        } catch (PDOException $e) {
            error_log('[MarketplaceEmail] Auto-migration check failed: ' . $e->getMessage());
        }
        $done = true;
    }
}

function getMarketplaceEmailService() {
    static $instance = null;
    if ($instance === null) {
        $instance = new MarketplaceEmailService();
    }
    return $instance;
}
