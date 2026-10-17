# Windows entry point for local CI. The steps live in ci.sh so the two
# cannot drift. Git for Windows Bash is required; GitHub Actions is not.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot 'ci.sh'
$git = Get-Command git.exe -ErrorAction SilentlyContinue
$gitRoot = $null
if ($git -and $git.Source -match '(?i)^(.*)\\cmd\\git\.exe$') {
  $gitRoot = $Matches[1]
}
$bashPath = $null
if ($gitRoot) {
  foreach ($candidate in @(
    (Join-Path $gitRoot 'bin\bash.exe'),
    (Join-Path $gitRoot 'usr\bin\bash.exe')
  )) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      $bashPath = $candidate
      break
    }
  }
}
if (-not $bashPath) {
  $bashPath = Get-Command bash.exe -All -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Source -and $_.Source -match '(?i)\\(?:Git|PortableGit)\\(?:bin|usr\\bin)\\bash\.exe$'
    } |
    Select-Object -First 1 -ExpandProperty Source
}
if (-not $bashPath) {
  throw 'scripts/ci.ps1 needs Git for Windows Bash. Install Git for Windows or add its bin\bash.exe to PATH; WSL and the WindowsApps bash alias are not supported.'
}

Push-Location $root
$exitCode = 0
try {
  & $bashPath $script
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($exitCode -ne 0) { exit $exitCode }
