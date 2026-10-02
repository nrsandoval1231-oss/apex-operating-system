# Windows entry point for local CI. The steps live in ci.sh so the two
# cannot drift. Git Bash or WSL is required; GitHub Actions is not.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot 'ci.sh'
$bash = Get-Command bash -ErrorAction SilentlyContinue
if (-not $bash) {
  throw 'scripts/ci.ps1 needs bash (Git Bash or WSL) to run scripts/ci.sh.'
}
Push-Location $root
try {
  & $bash.Source $script
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
