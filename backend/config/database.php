<?php
/**
 * Database Configuration & Connection
 * Reads credentials from .env file via env_loader.php
 */

require_once __DIR__ . '/env_loader.php';

// Load environment variables from .env
loadEnv(__DIR__ . '/../.env');

function getDBConnection(): PDO {
    $host = getenv('DB_HOST') ?: 'localhost';
    $port = getenv('DB_PORT') ?: '3306';
    $user = getenv('DB_USER') ?: 'root';
    $pass = getenv('DB_PASSWORD') ?: '';
    $db   = getenv('DB_NAME') ?: 'epsjci';

    try {
        $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false
        ]);
        return $pdo;
    } catch (PDOException $e) {
        // Log the real reason server-side; never leak DB internals to clients.
        error_log('DB connection failed: ' . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'error'   => 'Server is temporarily unavailable. Please try again shortly.'
        ]);
        exit;
    }
}
