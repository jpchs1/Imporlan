<?php
/**
 * Catálogo del programa "Importa tú mismo".
 *
 * Fuente de verdad del lado servidor para:
 *   - api/diy_downloads.php  (entrega del material)
 *   - api/email_service.php  (email con los links de descarga)
 *
 * Debe mantenerse alineado con LIBRARY / PLANS de
 * assets/importa-tu-mismo-checkout.js
 */

if (!defined('DIY_CATALOG_LOADED')) {
    define('DIY_CATALOG_LOADED', true);

    define('DIY_SITE', 'https://www.imporlan.cl');

    /** Documentos disponibles. `free` se entrega sin compra. */
    function diyDocs() {
        return [
            'mini-guia'   => ['file' => '00-mini-guia-gratis-importar-embarcacion-usa-chile.pdf', 'title' => 'Mini-guía: importar en 8 pasos',                'pages' => 8,  'free' => true],
            'manual'      => ['file' => '01-manual-maestro-importacion-usa-chile.pdf',            'title' => 'Manual Maestro de Importación USA a Chile',    'pages' => 13],
            'checklist'   => ['file' => '02-checklist-maestro-70-puntos.pdf',                     'title' => 'Checklist Maestro de 70 puntos',               'pages' => 6],
            'costos'      => ['file' => '03-guia-costos-aranceles-impuestos.pdf',                 'title' => 'Guía de Costos, Aranceles e Impuestos',        'pages' => 10],
            'calculadora' => ['file' => 'calculadora-costos-importacion-imporlan.csv',            'title' => 'Planilla de cálculo de costos',                'pages' => 0],
            'documentos'  => ['file' => '04-documentos-formularios-y-plantillas.pdf',             'title' => 'Documentos, formularios y plantillas',         'pages' => 8],
            'directemar'  => ['file' => '05-tramites-directemar-y-matricula.pdf',                 'title' => 'Trámites DIRECTEMAR y matrícula en Chile',     'pages' => 7],
            'logistica'   => ['file' => '06-logistica-fletes-seguro-e-inspeccion.pdf',            'title' => 'Logística, fletes, seguro e inspección',       'pages' => 7],
            'errores'     => ['file' => '07-errores-costosos-y-como-evitarlos.pdf',               'title' => '25 errores costosos y cómo evitarlos',         'pages' => 7],
            'directorio'  => ['file' => '08-directorio-proveedores-y-negociacion.pdf',            'title' => 'Directorio de proveedores y negociación',      'pages' => 8],
            'post'        => ['file' => '09-post-importacion-en-chile.pdf',                       'title' => 'Después de importar: puesta en marcha',        'pages' => 6],
        ];
    }

    /** Planes y los documentos que incluye cada uno. */
    function diyPlans() {
        $base = ['manual', 'checklist', 'costos', 'calculadora', 'documentos', 'directemar', 'logistica', 'errores'];
        return [
            'navegante' => ['name' => 'Plan Navegante',      'docs' => $base],
            'timonel'   => ['name' => 'Plan Timonel',        'docs' => array_merge($base, ['directorio'])],
            'patron'    => ['name' => 'Plan Patrón de Nave', 'docs' => array_merge($base, ['directorio', 'post'])],
        ];
    }

    /** ¿La compra corresponde al programa "Importa tú mismo"? */
    function diyIsProgramPurchase($purchase) {
        $label = ($purchase['plan_name'] ?? '') . ' ' . ($purchase['description'] ?? '');
        // "Importa" a secas también aparece en "importación": exigimos el nombre
        // completo del programa y además un plan reconocible.
        if (stripos($label, 'importa') === false) return false;
        if (stripos($label, 'mismo') === false) return false;
        return diyPlanIdFromLabel($label) !== null;
    }

    /** Deduce el id de plan desde el nombre guardado en la compra. */
    function diyPlanIdFromLabel($label) {
        $l = strtolower($label);
        if (strpos($l, 'patr') !== false) return 'patron';
        if (strpos($l, 'timonel') !== false) return 'timonel';
        if (strpos($l, 'navegante') !== false) return 'navegante';
        return null;
    }

    /**
     * Token de descarga de una compra: el order_id si existe, si no el payment_id.
     * Devuelve ['param' => 'order'|'payment_id', 'value' => '...'] o null.
     */
    function diyPurchaseToken($purchase) {
        // El identificador debe poder viajar en una URL y pasar la validación de
        // api/diy_downloads.php. El external_reference de MercadoPago lleva
        // espacios y acentos, así que en ese caso usamos el payment_id.
        $order = (string)($purchase['order_id'] ?? '');
        if ($order !== '' && preg_match('/^[A-Za-z0-9_\-]{6,64}$/', $order)) {
            return ['param' => 'order', 'value' => $order];
        }
        $paymentId = (string)($purchase['payment_id'] ?? '');
        if ($paymentId !== '' && preg_match('/^[A-Za-z0-9_\-]{4,64}$/', $paymentId)) {
            return ['param' => 'payment_id', 'value' => $paymentId];
        }
        return null;
    }

    /** URL absoluta de descarga de un documento para una compra dada. */
    function diyDownloadUrl($docId, $token) {
        if (!$token) return '';
        return DIY_SITE . '/api/diy_downloads.php?action=file&doc=' . rawurlencode($docId)
            . '&' . $token['param'] . '=' . rawurlencode($token['value']);
    }

    /** URL de la página de entrega (con todas las descargas) para una compra. */
    function diyThanksUrl($planId, $token) {
        $url = DIY_SITE . '/importa-tu-mismo/gracias/?plan=' . rawurlencode($planId ?: 'navegante');
        if ($token) $url .= '&' . $token['param'] . '=' . rawurlencode($token['value']);
        return $url . '&payment=success';
    }

    /**
     * Lista de documentos entregables de una compra, ya con su URL de descarga.
     * Devuelve [] si la compra no pertenece al programa.
     */
    function diyDeliverables($purchase) {
        $planId = diyPlanIdFromLabel(($purchase['plan_name'] ?? '') . ' ' . ($purchase['description'] ?? ''));
        if (!$planId) return [];

        $plans = diyPlans();
        $docs = diyDocs();
        $token = diyPurchaseToken($purchase);
        $out = [];

        foreach ($plans[$planId]['docs'] as $docId) {
            if (!isset($docs[$docId])) continue;
            $out[] = [
                'id' => $docId,
                'title' => $docs[$docId]['title'],
                'pages' => $docs[$docId]['pages'],
                'kind' => (substr($docs[$docId]['file'], -4) === '.csv') ? 'csv' : 'pdf',
                'url' => diyDownloadUrl($docId, $token),
            ];
        }
        return $out;
    }
}
