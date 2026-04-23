param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("dev", "build", "start")]
  [string]$Mode
)

$ErrorActionPreference = "Stop"

$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$shadowRoot = "C:\Users\Rameel\AppData\Local\avtive-shadow"

if (!(Test-Path $shadowRoot)) {
  New-Item -ItemType Directory -Path $shadowRoot | Out-Null
}

Write-Host "Syncing source to shadow workspace..."
robocopy $sourceRoot $shadowRoot /MIR /XD node_modules .next .git .vercel /XF "*.log" > $null
$rc = $LASTEXITCODE
if ($rc -ge 8) {
  throw "robocopy failed with exit code $rc"
}

Set-Location $shadowRoot

if (!(Test-Path (Join-Path $shadowRoot "node_modules"))) {
  Write-Host "Installing dependencies in shadow workspace..."
  npm install
}

switch ($Mode) {
  "dev" {
    Write-Host "Starting dev server from shadow workspace..."
    npm run dev
  }
  "build" {
    Write-Host "Running build from shadow workspace..."
    npm run build
  }
  "start" {
    Write-Host "Starting production server from shadow workspace..."
    npm run start
  }
}
