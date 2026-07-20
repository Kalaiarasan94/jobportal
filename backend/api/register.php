<?php
/**
 * API: Register for Malligai EPS
 * POST /api/register.php   (multipart/form-data)
 *
 * Fields: full_name, phone, email, dob, address  — all mandatory
 * Files:  profile_photo, payment_screenshot — any image format, both mandatory
 *
 * The registration is stored as PENDING. No registration number is issued here;
 * a running number (EPS-<year>-001…) is allocated when an admin approves it.
 */

require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../lib/upload.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$cfg = appConfig();

$full_name = trim($_POST['full_name'] ?? '');
$phone     = trim($_POST['phone'] ?? '');
$email     = trim($_POST['email'] ?? '');
$dob       = trim($_POST['dob'] ?? '');
$address   = trim($_POST['address'] ?? '');

// ---------------------------------------------------------------- validation
$errors = [];

if ($full_name === '')                                  $errors['full_name'] = 'Name is required';
if ($phone === '')                                      $errors['phone']     = 'WhatsApp number is required';
elseif (!preg_match('/^[0-9+\-\s]{10,20}$/', $phone))    $errors['phone']     = 'Enter a valid WhatsApp number';
if ($email === '')                                      $errors['email']     = 'Mail ID is required';
elseif (!filter_var($email, FILTER_VALIDATE_EMAIL))     $errors['email']     = 'Enter a valid mail ID';
if ($dob === '')                                        $errors['dob']       = 'Date of birth is required';
elseif (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob))     $errors['dob']       = 'Enter a valid date of birth';
if ($address === '')                                    $errors['address']   = 'Address is required';

if ($errors) {
    http_response_code(422);
    echo json_encode(['success' => false, 'errors' => $errors]);
    exit;
}

// ---------------------------------------------------------------- file uploads
$photo = storeUploadedImage($_FILES['profile_photo'] ?? null, $cfg['upload_dir'], $cfg['max_upload_mb'], 'photo');
if (!$photo['ok']) {
    http_response_code(422);
    echo json_encode(['success' => false, 'errors' => ['profile_photo' => $photo['error']]]);
    exit;
}

$pay = storeUploadedImage($_FILES['payment_screenshot'] ?? null, $cfg['upload_dir'], $cfg['max_upload_mb'], 'pay');
if (!$pay['ok']) {
    @unlink($photo['path']);
    http_response_code(422);
    echo json_encode(['success' => false, 'errors' => ['payment_screenshot' => $pay['error']]]);
    exit;
}

// ------------------------------------------------------------------ persist
try {
    $pdo = getDBConnection();

    $stmt = $pdo->prepare(
        'INSERT INTO eps_registrations
            (reg_no, reg_seq, full_name, phone, email, dob, address,
             photo_file, photo_mime, payment_file, payment_mime, payment_amount, payment_status)
         VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    $stmt->execute([
        $full_name, $phone, $email, $dob, $address,
        $photo['file'], $photo['mime'],
        $pay['file'], $pay['mime'],
        $cfg['fee'], 'PENDING',
    ]);

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Registration submitted. It will be confirmed after verification.',
    ]);
} catch (PDOException $e) {
    @unlink($photo['path']);
    @unlink($pay['path']);
    error_log('EPS insert error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not save your registration. Please try again.']);
}
