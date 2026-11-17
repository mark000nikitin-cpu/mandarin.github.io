param([int]$Port = 8123)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Сова: http://127.0.0.1:$Port/"
Write-Host "Папка: $root"
Write-Host "Остановить: Ctrl+C"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".png"  = "image/png"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".txt"  = "text/plain; charset=utf-8"
  ".md"   = "text/markdown; charset=utf-8"
}

function Send-Response($stream, [int]$status, [string]$reason, [string]$type, [byte[]]$body) {
  $head = "HTTP/1.1 $status $reason`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache, no-store, must-revalidate`r`nConnection: close`r`n`r`n"
  $headBytes = [System.Text.Encoding]::UTF8.GetBytes($head)
  $stream.Write($headBytes, 0, $headBytes.Length)
  if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

while ($true) {
  try {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000
    $buffer = New-Object byte[] 8192
    $builder = New-Object System.Text.StringBuilder
    do {
      $read = $stream.Read($buffer, 0, $buffer.Length)
      if ($read -le 0) { break }
      [void]$builder.Append([System.Text.Encoding]::ASCII.GetString($buffer, 0, $read))
    } while ($builder.ToString() -notmatch "`r`n`r`n" -and $builder.Length -lt 32768)

    $request = $builder.ToString()
    $firstLine = ($request -split "`r`n")[0]
    $parts = $firstLine -split " "
    $method = if ($parts.Length -gt 0) { $parts[0] } else { "GET" }
    $rawPath = if ($parts.Length -gt 1) { $parts[1] } else { "/" }

    if ($method -ne "GET" -and $method -ne "HEAD") {
      Send-Response $stream 405 "Method Not Allowed" "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("Method not allowed"))
      $client.Close()
      continue
    }

    $decoded = [System.Uri]::UnescapeDataString(($rawPath -split "\?")[0])
    if ($decoded -eq "/" -or $decoded -eq "") { $decoded = "/index.html" }
    $relative = $decoded.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
    $rootFull = [System.IO.Path]::GetFullPath($root)

    if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      Send-Response $stream 404 "Not Found" "text/plain; charset=utf-8" $body
      $client.Close()
      continue
    }

    $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
    $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($full)
    if ($method -eq "HEAD") {
      Send-Response $stream 200 "OK" $type (New-Object byte[] 0)
    } else {
      Send-Response $stream 200 "OK" $type $bytes
    }
    $client.Close()
  } catch {
    try { if ($client) { $client.Close() } } catch { }
    Start-Sleep -Milliseconds 40
  }
}
