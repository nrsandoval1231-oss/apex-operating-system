# render.ps1 — export every slide of a .pptx to PNG for visual QA.
#
# There is no LibreOffice on this machine, so this drives PowerPoint itself over COM.
# PowerPoint opening the file is also the strongest validity check available: it is the one
# consumer that rejects the malformed chart XML other tools quietly accept.
#
#   .\render.ps1 ..\apex-strategy-deck.pptx .\render

param(
  [Parameter(Mandatory = $true)][string]$Deck,
  [string]$OutDir = ".\render"
)

$deckPath = (Resolve-Path $Deck).Path
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }
$outPath = (Resolve-Path $OutDir).Path
Remove-Item (Join-Path $outPath "*.png") -Force -ErrorAction SilentlyContinue

$ppt = New-Object -ComObject PowerPoint.Application
try {
  # Open(FileName, ReadOnly, Untitled, WithWindow) — msoTrue = -1, msoFalse = 0
  $pres = $ppt.Presentations.Open($deckPath, -1, 0, 0)
  $count = $pres.Slides.Count
  for ($i = 1; $i -le $count; $i++) {
    $file = Join-Path $outPath ("slide-{0:D2}.png" -f $i)
    $pres.Slides.Item($i).Export($file, "PNG", 1600, 900)
  }
  $pres.Close()
  Write-Output "rendered $count slides to $outPath"
}
finally {
  $ppt.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
