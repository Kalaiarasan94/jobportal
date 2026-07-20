<?php
/**
 * API: Public configuration
 * GET /api/config.php
 *
 * Lets the registration page render the fee and contact buttons from a single
 * source of truth (the backend .env) instead of hard-coded frontend values.
 */

require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/cors.php';

setCorsHeaders();

$cfg = appConfig();

echo json_encode([
    'org_name'         => $cfg['org_name'],
    'event_name'       => $cfg['event_name'],
    'fee'              => $cfg['fee'],
    'contact_phone'    => $cfg['contact_phone'],
    'contact_whatsapp' => $cfg['contact_whatsapp'],
    'max_upload_mb'    => $cfg['max_upload_mb'],
]);
