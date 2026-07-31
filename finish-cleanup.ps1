# Apex cleanup - finishing step (2026-07-31)
# Completes the two items the first run could not: flatten apex-website,
# then make the final cleanup commit. Safe to re-run; skips anything done.
#
# BEFORE RUNNING: close anything that has the apex-website folder open -
# VS Code windows, File Explorer, terminals sitting inside that folder.

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\NickSandoval\Desktop\Nick-Assistant\Projects\Apex'
$td = Join-Path $root '_to_delete'
Set-Location $root

# ---- flatten apex-website (same logic as before) ----
$name  = 'apex-website'
$outer = Join-Path $root $name
$inner = Join-Path $outer $name

if (Test-Path $inner) {
    $wrap = "$outer._wrap"
    Rename-Item -Path $outer -NewName (Split-Path $wrap -Leaf)
    Move-Item -Path (Join-Path $wrap $name) -Destination $outer
    $leftover = Get-ChildItem -Force $wrap
    foreach ($item in $leftover) {
        if ($item.Name -eq '.claude' -and -not (Test-Path (Join-Path $outer '.claude'))) {
            Write-Host "  moving wrapper .claude into the repo"
            Move-Item $item.FullName $outer
        } else {
            Write-Host "  wrapper leftover '$($item.Name)' -> _to_delete"
            Move-Item $item.FullName (Join-Path $td "wrap-$name-$($item.Name)")
        }
    }
    if ((Get-ChildItem -Force $wrap | Measure-Object).Count -eq 0) { Remove-Item $wrap }
    Write-Host "  flattened $name" -ForegroundColor Green
} else {
    Write-Host "  $name already flat - skipping" -ForegroundColor Yellow
}

# ---- remove the emptied pre-adoption apex-os shell ----
# Contents already live in apps\apex-os. Verified empty before removal.
$oldOs = Join-Path $root 'apex-os'
if (Test-Path $oldOs) {
    if ((Get-ChildItem -Force $oldOs | Measure-Object).Count -eq 0) {
        Remove-Item $oldOs
        Write-Host "  removed empty pre-adoption apex-os\ shell" -ForegroundColor Green
    } else {
        Write-Host "  apex-os\ is NOT empty - leaving it alone, inspect manually" -ForegroundColor Yellow
        Get-ChildItem -Force $oldOs | Select-Object Name | Format-Table -AutoSize
    }
}

# ---- final cleanup commit ----
git -C $root add -A
git -C $root diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git -C $root commit -m "chore: folder cleanup - stage superseded artifacts in _to_delete, flatten wrapper dirs, add docs/vision.md, realign README/status/repositories"
} else { Write-Host 'Nothing to commit for cleanup.' -ForegroundColor Yellow }

# ---- summary ----
Write-Host "`n=== Done. Final state ===" -ForegroundColor Cyan
git -C $root status --short
Write-Host "`n_to_delete contents (inspect, then empty it yourself when satisfied):"
Get-ChildItem -Force $td | Select-Object Mode, Length, Name | Format-Table -AutoSize
Write-Host "Run 'pnpm verify' before the next build session." -ForegroundColor Cyan
