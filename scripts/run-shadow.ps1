param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("dev", "build", "start", "watch")]
  [string]$Mode
)

$ErrorActionPreference = "Stop"

$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$shadowRoot = "C:\Users\Rameel\AppData\Local\avtive-shadow"
$excludeDirFragments = @("\node_modules\", "\.next\", "\.git\", "\.vercel\")

function Sync-Workspace {
  robocopy $sourceRoot $shadowRoot /MIR /XD node_modules .next .git .vercel /XF "*.log" > $null
  $rc = $LASTEXITCODE
  if ($rc -ge 8) {
    throw "robocopy failed with exit code $rc"
  }
}

if (!(Test-Path $shadowRoot)) {
  New-Item -ItemType Directory -Path $shadowRoot | Out-Null
}

Write-Host "Syncing source to shadow workspace..."
Sync-Workspace

if ($Mode -eq "watch") {
  Write-Host "Watching source workspace for changes..."
  $global:pendingSync = $false
  $global:lastSyncAt = Get-Date

  $watcher = New-Object System.IO.FileSystemWatcher
  $watcher.Path = $sourceRoot
  $watcher.Filter = "*"
  $watcher.IncludeSubdirectories = $true
  $watcher.NotifyFilter = [IO.NotifyFilters]'FileName, LastWrite, DirectoryName, Size, CreationTime'

  $onChange = {
    param($sender, $eventArgs)
    $fullPath = [string]$eventArgs.FullPath
    foreach ($fragment in $using:excludeDirFragments) {
      if ($fullPath.Contains($fragment)) {
        return
      }
    }
    $global:pendingSync = $true
  }

  $createdSub = Register-ObjectEvent $watcher Created -Action $onChange
  $changedSub = Register-ObjectEvent $watcher Changed -Action $onChange
  $deletedSub = Register-ObjectEvent $watcher Deleted -Action $onChange
  $renamedSub = Register-ObjectEvent $watcher Renamed -Action $onChange
  $watcher.EnableRaisingEvents = $true

  try {
    while ($true) {
      Start-Sleep -Milliseconds 400
      if ($global:pendingSync -and ((Get-Date) - $global:lastSyncAt).TotalMilliseconds -ge 600) {
        try {
          Sync-Workspace
          $global:lastSyncAt = Get-Date
          $global:pendingSync = $false
          Write-Host "Synced shadow workspace."
        }
        catch {
          Write-Warning "Shadow sync failed: $($_.Exception.Message)"
          $global:lastSyncAt = Get-Date
        }
      }
    }
  }
  finally {
    $watcher.EnableRaisingEvents = $false
    Unregister-Event -SubscriptionId $createdSub.Id -ErrorAction SilentlyContinue
    Unregister-Event -SubscriptionId $changedSub.Id -ErrorAction SilentlyContinue
    Unregister-Event -SubscriptionId $deletedSub.Id -ErrorAction SilentlyContinue
    Unregister-Event -SubscriptionId $renamedSub.Id -ErrorAction SilentlyContinue
    $watcher.Dispose()
  }
}

Set-Location $shadowRoot

if (!(Test-Path (Join-Path $shadowRoot "node_modules"))) {
  Write-Host "Installing dependencies in shadow workspace..."
  npm install
}

switch ($Mode) {
  "dev" {
    $watchProcess = $null
    Write-Host "Starting shadow sync watcher..."
    $watchProcess = Start-Process powershell -PassThru -WindowStyle Hidden -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", "`"$PSCommandPath`"",
      "-Mode", "watch"
    )
    Write-Host "Starting dev server from shadow workspace..."
    try {
      npm run dev
    }
    finally {
      if ($watchProcess -and -not $watchProcess.HasExited) {
        Stop-Process -Id $watchProcess.Id -Force -ErrorAction SilentlyContinue
      }
    }
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
