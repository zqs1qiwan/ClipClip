param(
  [string]$Name = "",
  [string]$Email = "",
  [string]$InstallRoot = "$env:USERPROFILE\Documents\Codex\tools\mingit"
)

$ErrorActionPreference = "Stop"

function Add-UserPathEntry {
  param([string]$Entry)
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @()
  if ($current) {
    $parts = $current -split ";" | Where-Object { $_ -ne "" }
  }
  if ($parts -notcontains $Entry) {
    $next = (@($parts) + $Entry) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $next, "User")
  }
  if (($env:Path -split ";") -notcontains $Entry) {
    $env:Path = "$Entry;$env:Path"
  }
}

function Find-Git {
  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $candidates = @(
    "$InstallRoot\cmd\git.exe",
    "$InstallRoot\mingw64\bin\git.exe",
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\git.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  return $null
}

$gitExe = Find-Git

if (-not $gitExe) {
  $api = "https://api.github.com/repos/git-for-windows/git/releases/latest"
  $release = Invoke-RestMethod -Headers @{ "User-Agent" = "ClipClip Git setup" } -Uri $api
  $asset = $release.assets |
    Where-Object { $_.name -like "MinGit-*-64-bit.zip" -and $_.name -notlike "*busybox*" } |
    Select-Object -First 1

  if (-not $asset) {
    throw "Could not find a 64-bit MinGit zip in the latest Git for Windows release."
  }

  $toolsRoot = Split-Path -Parent $InstallRoot
  New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
  $zipPath = Join-Path $toolsRoot $asset.name
  $tmpExtract = Join-Path $toolsRoot "mingit-extract"

  Write-Host "Downloading $($asset.name)..."
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath

  if (Test-Path -LiteralPath $tmpExtract) {
    Remove-Item -LiteralPath $tmpExtract -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $tmpExtract | Out-Null
  Expand-Archive -LiteralPath $zipPath -DestinationPath $tmpExtract -Force

  if (Test-Path -LiteralPath $InstallRoot) {
    Remove-Item -LiteralPath $InstallRoot -Recurse -Force
  }
  Move-Item -LiteralPath $tmpExtract -Destination $InstallRoot

  $gitExe = Find-Git
}

if (-not $gitExe) {
  throw "Git was not found after setup."
}

$gitCmdDir = Split-Path -Parent $gitExe
if ((Split-Path -Leaf $gitCmdDir) -ne "cmd" -and (Test-Path -LiteralPath "$InstallRoot\cmd")) {
  $gitCmdDir = "$InstallRoot\cmd"
}
Add-UserPathEntry -Entry $gitCmdDir

& $gitExe config --global init.defaultBranch main
& $gitExe config --global core.autocrlf input
& $gitExe config --global core.longpaths true
& $gitExe config --global pull.rebase false
& $gitExe config --global fetch.prune true

if ($Name.Trim()) {
  & $gitExe config --global user.name $Name
}

if ($Email.Trim()) {
  & $gitExe config --global user.email $Email
}

Write-Host ""
Write-Host "Git is ready:"
& $gitExe --version
Write-Host "Path added for future terminals: $gitCmdDir"
Write-Host ""
Write-Host "Current global Git config:"
& $gitExe config --global --list
