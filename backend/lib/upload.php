<?php
/**
 * Shared image-upload helper for the registration form.
 */

/** Common image formats accepted for both the profile photo and the receipt. */
function allowedImageExts(): array
{
    return [
        'image/jpeg' => 'jpg', 'image/pjpeg' => 'jpg', 'image/png' => 'png',
        'image/gif'  => 'gif', 'image/webp'  => 'webp', 'image/bmp' => 'bmp',
        'image/x-ms-bmp' => 'bmp', 'image/heic' => 'heic', 'image/heif' => 'heif',
        'image/tiff' => 'tiff',
    ];
}

/**
 * Validate an uploaded image and move it into the uploads directory.
 *
 * @return array{ok:bool, error?:string, file?:string, mime?:string, path?:string}
 */
function storeUploadedImage(?array $file, string $uploadDir, int $maxMb, string $prefix): array
{
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return ['ok' => false, 'error' => 'File is required'];
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return ['ok' => false, 'error' => 'Upload failed, please try again'];
    }
    if ($file['size'] > $maxMb * 1024 * 1024) {
        return ['ok' => false, 'error' => "Image must be under {$maxMb} MB"];
    }

    $allowed = allowedImageExts();
    $finfo   = new finfo(FILEINFO_MIME_TYPE);
    $mime    = $finfo->file($file['tmp_name']) ?: '';
    $ext     = $allowed[$mime] ?? null;

    if ($ext === null) {
        // HEIC and some others aren't always recognised by libmagic — fall back
        // to the extension when the browser reported an image content type.
        $sentExt  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $sentMime = strtolower($file['type'] ?? '');
        if (str_starts_with($sentMime, 'image/') && in_array($sentExt, $allowed, true)) {
            $ext  = $sentExt;
            $mime = $sentMime;
        } else {
            return ['ok' => false, 'error' => 'Please upload an image (JPG, PNG, GIF, WEBP, BMP, HEIC)'];
        }
    }

    if (!is_dir($uploadDir) && !@mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
        return ['ok' => false, 'error' => 'Upload directory is not writable'];
    }

    $stored = $prefix . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    $target = $uploadDir . '/' . $stored;

    if (!move_uploaded_file($file['tmp_name'], $target)) {
        return ['ok' => false, 'error' => 'Could not save the uploaded image'];
    }

    return ['ok' => true, 'file' => $stored, 'mime' => $mime, 'path' => $target];
}
