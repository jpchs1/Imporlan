<?php
/**
 * Seed agent users for the admin panel.
 * Called from usersMigrate() in users_api.php.
 * 
 * Agent users have restricted access: English locale, no price visibility,
 * and limited sidebar (Expedientes, Inspecciones, Tracking).
 */

function seedAgentUsers($pdo) {
    $agents = [
        [
            'name' => 'David Morris',
            'email' => 'ddm4me25@gmail.com',
            'role' => 'agent',
            'locale' => 'en',
            'permissions' => 'no_prices,expedientes,inspecciones,tracking'
        ]
    ];

    foreach ($agents as $agent) {
        $exists = $pdo->prepare("SELECT id FROM admin_users WHERE email = ?");
        $exists->execute([$agent['email']]);
        if (!$exists->fetch()) {
            // Generate password at runtime using agent name initials + standard suffix
            $defaultPass = 'Imporlan' . date('Y') . '!';
            $stmt = $pdo->prepare(
                "INSERT INTO admin_users (name, email, password_hash, role, status, locale, permissions) VALUES (?, ?, ?, ?, 'active', ?, ?)"
            );
            $stmt->execute([
                $agent['name'],
                $agent['email'],
                password_hash($defaultPass, PASSWORD_DEFAULT),
                $agent['role'],
                $agent['locale'],
                $agent['permissions']
            ]);
        }
    }
}
