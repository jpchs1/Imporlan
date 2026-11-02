<?php
/**
 * Payment Requests Helper - Imporlan
 * 
 * Shared helper functions for payment requests system.
 * This file has NO side effects (no routing, no headers, no output).
 * Safe to require_once from any gateway file.
 */

if (!function_exists('handlePaymentRequestPaid')) {

    /**
     * Handle payment request completion after a successful payment.
     * Updates payment_requests.json, sends emails and chat messages.
     * Called by all payment gateways (MercadoPago, WebPay, PayPal).
     */
    function handlePaymentRequestPaid($paymentRequestId, $paymentId, $paymentMethod, $purchaseId = null, $capturedAmount = null) {
        try {
            require_once __DIR__.'/payment_balance.php';
            $request=impPaymentRead((string)$paymentRequestId);if(!$request)return;
            // Older gateways may finish a legacy invoice, but cannot infer a partial invoice's capture amount.
            if($capturedAmount===null) { if(impPaymentCredits($request))return;$capturedAmount=intval($request['amount_clp']); }
            $date=(new DateTimeImmutable('now',new DateTimeZone('America/Santiago')))->format('Y-m-d');
            [$code,$result]=impPaymentAddCredit((string)$paymentRequestId,['purchase_id'=>$purchaseId,'amount_clp'=>$capturedAmount,'bank'=>$paymentMethod,'reference'=>(string)$paymentId,'received_on'=>$date,'idempotency_key'=>'gateway_'.hash('sha256',$paymentMethod.':'.$paymentId)],'gateway:'.$paymentMethod,true);
            if($code!==200 || empty($result['newly_paid']))return;
            impPaymentNotifyCompleted($result['request']);
            try { require_once __DIR__.'/db_config.php';_createPaymentRequestChatMessage($result['request'],'paid'); }catch(Throwable $e){error_log('[payment-credit] chat confirmation failed');}
        } catch(Throwable $e) { error_log('[payment-credit] gateway reconciliation failed'); }
    }

    /**
     * Create chat notification message for payment requests.
     * Standalone version that doesn't require payment_requests_api.php routing.
     */
    function _createPaymentRequestChatMessage($request, $type = 'created') {
        try {
            $pdo = getDbConnection();
            if (!$pdo) return;
            
            $userEmail = $request['user_email'];
            if (empty($userEmail)) return;
            
            $userName = explode('@', $userEmail)[0];
            
            // Find or create conversation
            $stmt = $pdo->prepare("SELECT id FROM chat_conversations WHERE user_email = ? AND status = 'open' ORDER BY updated_at DESC LIMIT 1");
            $stmt->execute([$userEmail]);
            $conv = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$conv) {
                $stmt = $pdo->prepare("INSERT INTO chat_conversations (user_email, user_name, status, auto_messages_sent) VALUES (?, ?, 'open', '{}')");
                $stmt->execute([$userEmail, $userName]);
                $conversationId = intval($pdo->lastInsertId());
            } else {
                $conversationId = intval($conv['id']);
            }
            
            $amount = number_format($request['amount_clp'], 0, ',', '.');
            $title = $request['title'] ?? 'Solicitud de pago';
            $description = $request['description'] ?? '';
            
            if ($type === 'created') {
                $message = "Nueva solicitud de pago\n\n" .
                    "Se ha creado una solicitud de pago para ti:\n\n" .
                    "Titulo: {$title}\n" .
                    "Monto: \${$amount} CLP\n";
                if (!empty($description)) {
                    $message .= "Descripcion: {$description}\n";
                }
                    $message .= "\nPuedes pagar desde la seccion 'Pagos Pendientes' de tu panel usando:\n" .
                        "- Tarjeta de Credito/Debito\n" .
                        "- WebPay\n" .
                        "- MercadoPago\n" .
                        "- PayPal\n" .
                        "- Transferencia Bancaria\n\n" .
                        "Ingresa a tu panel para ver los detalles.";
            } elseif ($type === 'paid') {
                $paymentMethod = $request['payment_method'] ?? 'N/A';
                $paidAt = $request['paid_at'] ?? date('d/m/Y H:i');
                $message = "Pago confirmado\n\n" .
                    "Tu pago por '{$title}' ha sido procesado exitosamente.\n\n" .
                    "Monto: \${$amount} CLP\n" .
                    "Metodo: {$paymentMethod}\n" .
                    "Fecha: {$paidAt}\n\n" .
                    "Gracias por tu pago. Puedes ver el comprobante en 'Mis Productos'.";
            } else {
                return;
            }
            
            $stmt = $pdo->prepare("INSERT INTO chat_messages (conversation_id, sender_id, sender_role, sender_name, sender_email, message) VALUES (?, 0, 'system', 'Sistema Imporlan', NULL, ?)");
            $stmt->execute([$conversationId, $message]);
            
            $stmt = $pdo->prepare("UPDATE chat_conversations SET updated_at = NOW() WHERE id = ?");
            $stmt->execute([$conversationId]);
        } catch (Exception $e) {
            $logFile = __DIR__ . '/payment_requests.log';
            file_put_contents($logFile, date('Y-m-d H:i:s') . ' - CHAT_MSG_ERROR: ' . $e->getMessage() . "\n", FILE_APPEND);
        }
    }
    
    /**
     * Extract payment_request_id from MercadoPago external_reference.
     * Format: {payment_request_id}_{planName}_{timestamp}
     * The payment_request_id itself is like "pr_XXXXX"
     */
    function extractPaymentRequestId($externalRef) {
        if (strpos($externalRef, 'pr_') !== 0) return null;
        // Format: pr_UNIQID_planName_timestamp
        // We need to extract "pr_UNIQID" (first two segments joined by _)
        $parts = explode('_', $externalRef);
        if (count($parts) >= 2) {
            return $parts[0] . '_' . $parts[1]; // "pr" + "_" + "UNIQID"
        }
        return null;
    }
}
