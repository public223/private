<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['error' => 'Only POST method is allowed']);
    exit;
}

if (!isset($_POST['key']) || !isset($_POST['action'])) {
    echo json_encode(['error' => 'Missing required parameters']);
    exit;
}

$url = 'https://justanotherpanel.com/api/v2';

// بناء طلب POST للـ API الخارجي
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($_POST));
curl_setopt($ch, CURLOPT_TIMEOUT, 20);

$response = curl_exec($ch);

if (curl_errno($ch)) {
    echo json_encode(['error' => 'Curl error: ' . curl_error($ch)]);
    curl_close($ch);
    exit;
}

$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($statusCode !== 200) {
    echo json_encode(['error' => "API returned status code $statusCode"]);
    exit;
}

// إعادة إرسال رد الـ API مباشرة
echo $response;
