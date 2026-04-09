param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("chrome", "firefox")]
  [string]$Target
)

$source = Join-Path $PSScriptRoot ("manifest.{0}.json" -f $Target)
$destination = Join-Path $PSScriptRoot "manifest.json"

Copy-Item -LiteralPath $source -Destination $destination -Force
Write-Host ("Activated {0} manifest in manifest.json" -f $Target)
