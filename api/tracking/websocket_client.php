<?php
/**
 * Minimal WebSocket Client for PHP
 * 
 * Lightweight WebSocket client using PHP streams (no external dependencies).
 * Used by AISstream integration for real-time vessel position data.
 */

class WebSocketClient {
    private $socket = null;

    /**
     * Connect to a WebSocket server
     * @param string $url WebSocket URL (ws:// or wss://)
     * @param int $connectTimeout Connection timeout in seconds
     * @return bool True if connected successfully
     */
    public function connect($url, $connectTimeout = 10) {
        $parsed = parse_url($url);
        $host = $parsed['host'];
        $port = ($parsed['scheme'] === 'wss') ? 443 : 80;
        $path = $parsed['path'] ?? '/';
        $useSSL = ($parsed['scheme'] === 'wss');

        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ]
        ]);

        $address = ($useSSL ? 'ssl://' : 'tcp://') . $host . ':' . $port;
        $this->socket = @stream_socket_client($address, $errno, $errstr, $connectTimeout, STREAM_CLIENT_CONNECT, $context);

        if (!$this->socket) {
            error_log("[WebSocketClient] Connection failed: $errstr ($errno)");
            return false;
        }

        // WebSocket handshake
        $key = base64_encode(random_bytes(16));
        $headers = "GET $path HTTP/1.1\r\n" .
            "Host: $host\r\n" .
            "Upgrade: websocket\r\n" .
            "Connection: Upgrade\r\n" .
            "Sec-WebSocket-Key: $key\r\n" .
            "Sec-WebSocket-Version: 13\r\n" .
            "\r\n";

        fwrite($this->socket, $headers);

        // Read handshake response
        $response = '';
        while (($line = fgets($this->socket)) !== false) {
            $response .= $line;
            if (trim($line) === '') break;
        }

        if (strpos($response, '101') === false) {
            error_log("[WebSocketClient] Handshake failed: " . substr($response, 0, 200));
            fclose($this->socket);
            $this->socket = null;
            return false;
        }

        return true;
    }

    /**
     * Send a text message over the WebSocket
     * @param string $data Message to send
     * @return int|false Bytes written or false on failure
     */
    public function send($data) {
        if (!$this->socket) return false;

        $len = strlen($data);
        $mask = random_bytes(4);

        // Frame: FIN + opcode text
        $frame = chr(0x81);

        if ($len < 126) {
            $frame .= chr(0x80 | $len);
        } elseif ($len < 65536) {
            $frame .= chr(0x80 | 126) . pack('n', $len);
        } else {
            $frame .= chr(0x80 | 127) . pack('J', $len);
        }

        $frame .= $mask;

        for ($i = 0; $i < $len; $i++) {
            $frame .= $data[$i] ^ $mask[$i % 4];
        }

        return fwrite($this->socket, $frame);
    }

    /**
     * Read a message from the WebSocket
     * @param int $timeout Read timeout in seconds
     * @return string|null Message data or null on timeout/error
     */
    public function read($timeout = 5) {
        if (!$this->socket) return null;

        stream_set_timeout($this->socket, $timeout);

        $header = @fread($this->socket, 2);
        if ($header === false || strlen($header) < 2) return null;

        $info = stream_get_meta_data($this->socket);
        if ($info['timed_out']) return null;

        $opcode = ord($header[0]) & 0x0F;
        $masked = (ord($header[1]) & 0x80) !== 0;
        $len = ord($header[1]) & 0x7F;

        if ($len === 126) {
            $ext = fread($this->socket, 2);
            if (strlen($ext) < 2) return null;
            $len = unpack('n', $ext)[1];
        } elseif ($len === 127) {
            $ext = fread($this->socket, 8);
            if (strlen($ext) < 8) return null;
            $len = unpack('J', $ext)[1];
        }

        $maskKey = null;
        if ($masked) {
            $maskKey = fread($this->socket, 4);
        }

        $data = '';
        $remaining = $len;
        while ($remaining > 0) {
            $chunk = fread($this->socket, min($remaining, 8192));
            if ($chunk === false || strlen($chunk) === 0) break;
            $data .= $chunk;
            $remaining -= strlen($chunk);
        }

        if ($masked && $maskKey) {
            for ($i = 0; $i < strlen($data); $i++) {
                $data[$i] = $data[$i] ^ $maskKey[$i % 4];
            }
        }

        // Handle ping - send pong
        if ($opcode === 0x9) {
            $this->sendPong($data);
            return $this->read($timeout);
        }

        // Handle close
        if ($opcode === 0x8) {
            return null;
        }

        return $data;
    }

    /**
     * Send a pong frame
     */
    private function sendPong($data = '') {
        if (!$this->socket) return;

        $len = strlen($data);
        $mask = random_bytes(4);
        $frame = chr(0x8A); // FIN + pong
        $frame .= chr(0x80 | $len);
        $frame .= $mask;
        for ($i = 0; $i < $len; $i++) {
            $frame .= $data[$i] ^ $mask[$i % 4];
        }
        @fwrite($this->socket, $frame);
    }

    /**
     * Close the WebSocket connection
     */
    public function close() {
        if (!$this->socket) return;

        $mask = random_bytes(4);
        $frame = chr(0x88) . chr(0x80) . $mask;
        @fwrite($this->socket, $frame);
        @fclose($this->socket);
        $this->socket = null;
    }

    /**
     * Check if the connection is open
     * @return bool
     */
    public function isConnected() {
        return $this->socket !== null;
    }
}
