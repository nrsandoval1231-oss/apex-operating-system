# Apex folder cleanup - 2026-07-31
# Reviewed plan: commit dirty trees, stage superseded items into _to_delete\,
# flatten the three nested wrapper folders, then one cleanup commit.
#
# NOTHING IS DELETED by this script. Everything removed from the tree lands in
# _to_delete\ for you to inspect and empty yourself. The only Remove-Item calls
# are for wrapper folders verified empty immediately beforehand.
#
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File .\cleanup.ps1

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\NickSandoval\Desktop\Nick-Assistant\Projects\Apex'
Set-Location $root

Write-Host "=== Apex cleanup starting in $root ===" -ForegroundColor Cyan

# ---------------------------------------------------------------- sanity checks
if (-not (Test-Path "$root\.git"))      { throw "Root git repo not found - wrong folder?" }
if (-not (Test-Path "$root\packages"))  { throw "packages\ not found - wrong folder?" }
$confirm = Read-Host "This will move files into _to_delete\, flatten wrappers, and make git commits. Type YES to proceed"
if ($confirm -ne 'YES') { Write-Host 'Aborted, nothing changed.'; exit 1 }

# ---------------------------------------------------- 1. commit dirty trees first
Write-Host "`n--- Step 1: commit pre-existing changes ---" -ForegroundColor Cyan

# Root repo: only the files that were already dirty BEFORE cleanup, so the
# feature commit stays separate from the cleanup commit.
git -C $root add PRD.md package.json pnpm-workspace.yaml pnpm-lock.yaml
git -C $root diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git -C $root commit -m "chore: in-progress workspace and PRD updates (pre-cleanup checkpoint)"
} else { Write-Host 'Root repo: nothing staged for the pre-cleanup commit.' }

# Proposal engine
$pe = Join-Path $root 'apex-proposal-engine'
git -C $pe add -A
git -C $pe diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git -C $pe commit -m "chore: in-progress engine and test updates (pre-cleanup checkpoint)"
} else { Write-Host 'Proposal engine: working tree already clean.' }

# ------------------------------------------------------------- 2. staging area
Write-Host "`n--- Step 2: create _to_delete\ ---" -ForegroundColor Cyan
$td = Join-Path $root '_to_delete'
New-Item -ItemType Directory -Force -Path $td | Out-Null

function Stage($path, $why) {
    if (Test-Path $path) {
        Write-Host ("  moving  {0}  ({1})" -f $path, $why)
        Move-Item -Path $path -Destination $td
    } else {
        Write-Host ("  skip    {0}  (not found)" -f $path) -ForegroundColor Yellow
    }
}

# ------------------------------------------------------ 3. superseded artifacts
Write-Host "`n--- Step 3: move superseded items ---" -ForegroundColor Cyan
Stage "$root\Apex ideas.zip"              'all contents superseded by live repos'
Stage "$root\_inbox"                      'regenerable exports and older deck render'
Stage "$root\tmp"                         'abandoned n8n scratch session'
Stage "$root\Apex Lead Engine"            'orphaned snapshot; real repo is apex-lead-engine\'
Stage "$root\apex-pitch.pptx"             'regenerates from apex-decks'
Stage "$root\apex-strategy-deck.pptx"     'regenerates from apex-decks'
Stage "$root\apex-system-diagram.png"     'regenerates from apex-decks'

# .hermes desktop attachments (duplicate PRD + source PDFs - per decision 2026-07-31)
if (Test-Path "$root\.hermes\desktop-attachments") {
    Write-Host "  moving  .hermes\desktop-attachments  (duplicate PRD + transcribed PDFs)"
    Move-Item "$root\.hermes\desktop-attachments" "$td\hermes-desktop-attachments"
}

# Stray gate-v3.jsx copy inside the website repo (before flattening)
$stray = "$root\apex-website\apex-website\.hermes\desktop-attachments\gate-v3.jsx"
if (Test-Path $stray) {
    Write-Host "  moving  stray gate-v3.jsx from inside apex-website"
    Move-Item $stray "$td\website-stray-gate-v3.jsx"
}

# ------------------------------------------------------- 4. flatten the wrappers
Write-Host "`n--- Step 4: flatten nested wrapper folders ---" -ForegroundColor Cyan

function Flatten($name) {
    $outer = Join-Path $root $name
    $inner = Join-Path $outer $name
    if (-not (Test-Path $inner)) { Write-Host "  skip $name (no nested copy)" -ForegroundColor Yellow; return }

    $wrap = "$outer._wrap"
    Rename-Item -Path $outer -NewName (Split-Path $wrap -Leaf)
    Move-Item -Path (Join-Path $wrap $name) -Destination $outer
    # Anything else the wrapper held goes to _to_delete for inspection
    $leftover = Get-ChildItem -Force $wrap
    foreach ($item in $leftover) {
        if ($item.Name -eq '.claude' -and -not (Test-Path (Join-Path $outer '.claude'))) {
            Write-Host "  $name : moving wrapper .claude into the repo"
            Move-Item $item.FullName $outer
        } else {
            Write-Host "  $name : wrapper leftover '$($item.Name)' -> _to_delete"
            Move-Item $item.FullName (Join-Path $td "wrap-$name-$($item.Name)")
        }
    }
    # wrapper is now verified empty; removing the empty folder itself
    if ((Get-ChildItem -Force $wrap | Measure-Object).Count -eq 0) { Remove-Item $wrap }
    Write-Host "  flattened $name" -ForegroundColor Green
}

Flatten 'apex-lead-engine'
Flatten 'apex-prds'
Flatten 'apex-website'

# --------------------------------------------------------- 5. cleanup commit
Write-Host "`n--- Step 5: cleanup commit in root repo ---" -ForegroundColor Cyan
git -C $root add -A
git -C $root diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git -C $root commit -m "chore: folder cleanup - stage superseded artifacts in _to_delete, flatten wrapper dirs, add docs/vision.md, realign README/status/repositories"
} else { Write-Host 'Nothing to commit for cleanup (unexpected - check git status).' -ForegroundColor Yellow }

# --------------------------------------------------------------- 6. summary
Write-Host "`n=== Done. Final state ===" -ForegroundColor Cyan
git -C $root status --short
Write-Host "`n_to_delete contents (inspect, then empty it yourself when satisfied):"
Get-ChildItem -Force $td | Select-Object Mode, Length, Name | Format-Table -AutoSize
Write-Host "Reminder: 'pnpm verify' should still pass - run it before the next build session." -ForegroundColor Cyan
