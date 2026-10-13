$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version=(Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$name="FGO-Solo-Windows-$version-x64"
$folder=Join-Path $projectRoot "dist\$name"
$zip=Join-Path $projectRoot "dist\$name.zip"
if(!(Test-Path -LiteralPath (Join-Path $folder '一骑千筹.exe'))){throw '请先构建 Windows 软件。'}
if(Test-Path -LiteralPath $zip){Remove-Item -LiteralPath $zip}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($folder,$zip)
$hash=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
[IO.File]::WriteAllText((Join-Path $projectRoot 'dist\SHA256-Windows.txt'),"$hash  $name.zip"+[Environment]::NewLine)
Write-Output "ZIP: $zip"
Write-Output "SHA256: $hash"
