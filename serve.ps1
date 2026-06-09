# ============================================================
#  Tiny static file server (zero-install, Windows PowerShell)
#  Serves the folder this script lives in, so visual checks can
#  be automated via the preview tools. No Node/Python needed.
#
#  Run manually:   powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8137
#  Then open:      http://localhost:8137/
#  (Normally launched for you via .claude/launch.json -> "focus-app".)
# ============================================================
param([int]$Port = 8137)

$ErrorActionPreference = 'Stop'
$root   = $PSScriptRoot
$prefix = "http://localhost:$Port/"

$mime = @{
  '.html'='text/html; charset=utf-8';  '.htm'='text/html; charset=utf-8'
  '.css' ='text/css; charset=utf-8';   '.js' ='text/javascript; charset=utf-8'
  '.mjs' ='text/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8'
  '.svg' ='image/svg+xml';             '.png'='image/png'
  '.jpg' ='image/jpeg';                '.jpeg'='image/jpeg'
  '.gif' ='image/gif';                 '.ico'='image/x-icon'
  '.webp'='image/webp';                '.woff'='font/woff'
  '.woff2'='font/woff2';               '.ttf'='font/ttf'
  '.map' ='application/json';          '.txt'='text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving '$root'"
Write-Host "Listening on $prefix  (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
      $path = Join-Path $root $rel
      if (Test-Path -LiteralPath $path -PathType Container) {
        $path = Join-Path $path 'index.html'
      }
      if (Test-Path -LiteralPath $path -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $ext   = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
        $ct    = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
        $res.ContentType = $ct
        $res.Headers['Cache-Control'] = 'no-store'
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
        $res.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      try { $res.StatusCode = 500 } catch {}
    } finally {
      try { $res.OutputStream.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
