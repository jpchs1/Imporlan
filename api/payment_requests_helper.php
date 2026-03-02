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
    function handlePaymentRequestPaid($paymentRequestId, $paymentId, $paymentMethod, $purchaseId = null) {
        try {
            $prFile = __DIR__ . '/payment_requests.json';
            if (!file_exists($prFile)) return;
            
            // Use file locking to prevent concurrent write corruption
            $fp = fopen($prFile, 'r+');
            if (!$fp) return;
            
            if (!flock($fp, LOCK_EX)) {
                fclose($fp);
                return;
            }
            
            $contents = stream_get_contents($fp);
            $data = json_decode($contents, true);
            if (!$data || !isset($data['requests'])) {
                flock($fp, LOCK_UN);
                fclose($fp);
                return;
            }
            
            $found = false;
            foreach ($data['requests'] as &$request) {
                if ($request['id'] === $paymentRequestId && $request['status'] === 'pending') {
                    $request['status'] = 'paid';
                    $request['paid_at'] = date('Y-m-d H:i:s');
                    $request['payment_id'] = $paymentId;
                    $request['payment_method'] = $paymentMethod;
                    $request['purchase_id'] = $purchaseId;
                    $found = true;
                    
                    // Write updated data with lock held
                    fseek($fp, 0);
                    ftruncate($fp, 0);
                    fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
                    fflush($fp);
                    
                    // Send paid email
                    try {
                        require_once __DIR__ . '/email_service.php';
                        $emailService = new EmailService();
                        $firstName = explode('@', $request['user_email'])[0];
                        $emailService->sendPaymentRequestPaidEmail(
                            $request['user_email'],
                            $firstName,
                            $request,
                            [
                                'payment_id' => $paymentId,
                                'payment_method' => $paymentMethod,
                                'paid_at' => $request['paid_at']
                            ]
                        );
                    } catch (Exception $e) {
                        $logFile = __DIR__ . '/payment_requests.log';
                        file_put_contents($logFile, date('Y-m-d H:i:s') . ' - PAID_EMAIL_ERROR: ' . $e->getMessage() . "\n", FILE_APPEND);
                    }
                    
                    // Create chat message
                    try {
                        require_once __DIR__ . '/db_config.php';
                        _createPaymentRequestChatMessage($request, 'paid');
                    } catch (Exception $e) {
                        $logFile = __DIR__ . '/payment_requests.log';
                        file_put_contents($logFile, date('Y-m-d H:i:s') . ' - PAID_CHAT_ERROR: ' . $e->getMessage() . "\n", FILE_APPEND);
                    }
                    
                    // Log
                    $logFile = __DIR__ . '/payment_requests.log';
                    file_put_contents($logFile, date('Y-m-d H:i:s') . ' [PAID] ' . json_encode([
                        'id' => $paymentRequestId,
                        'payment_id' => $paymentId,
                        'method' => $paymentMethod,
                        'user' => $request['user_email']
                    ]) . "\n", FILE_APPEND);
                    
                    break;
                }
            }
            
            flock($fp, LOCK_UN);
            fclose($fp);
        } catch (Exception $e) {
            $logFile = __DIR__ . '/payment_requests.log';
            file_put_contents($logFile, date('Y-m-d H:i:s') . ' - HANDLE_PAID_ERROR: ' . $e->getMessage() . "\n", FILE_APPEND);
        }
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
                    "- MercadoPago\n" .
                    "- PayPal\n\n" .
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
