$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$prismaClientDir = Join-Path $root 'node_modules\.prisma\client'
$currentScriptPattern = 'prisma:generate:clean'
$killPatterns = @(
  'node_modules\\@nestjs\\cli\\bin\\nest',
  'apps\\api\\dist\\src\\main',
  'prisma studio',
  'jest --watch',
  'ts-node.*library-system-v2'
)

$nodeProcesses = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue
$targets = @($nodeProcesses | Where-Object {
  $cmd = $_.CommandLine
  if ([string]::IsNullOrWhiteSpace($cmd)) { return $false }
  if ($cmd -match $currentScriptPattern) { return $false }
  foreach ($pattern in $killPatterns) {
    if ($cmd -match $pattern) { return $true }
  }
  return $false
})

foreach ($target in $targets) {
  Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue
}

if (Test-Path $prismaClientDir) {
  Get-ChildItem -Path $prismaClientDir -Filter 'query_engine-windows.dll.node.tmp*' -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue
}

Push-Location (Join-Path $PSScriptRoot '..')
try {
  prisma generate
}
finally {
  Pop-Location
}
