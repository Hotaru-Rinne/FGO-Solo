$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version=(Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$apk=Join-Path $projectRoot ("dist\FGO-Solo-$version.apk")
$archive=[IO.Compression.ZipFile]::OpenRead($apk)
try {
  if(!$archive.GetEntry('classes.dex')){throw 'APK 缺少原生入口。'}
  if($archive.Entries.FullName | Where-Object {$_ -match '\\'}){throw 'APK ZIP 路径含 Windows 分隔符。'}
  $files=@(Get-Item -LiteralPath (Join-Path $projectRoot 'index.html'))+@(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src'),(Join-Path $projectRoot 'public') -File -Recurse)
  foreach($file in $files){
    $relative=$file.FullName.Substring($projectRoot.Length+1).Replace('\','/')
    $entry=$archive.GetEntry('assets/'+$relative)
    if(!$entry){throw "APK 缺少资源：$relative"}
    $reader=[IO.StreamReader]::new($entry.Open())
    try{$content=$reader.ReadToEnd()}finally{$reader.Dispose()}
    if($content -cne [IO.File]::ReadAllText($file.FullName)){throw "APK 资源与源码不一致：$relative"}
  }
}finally{$archive.Dispose()}
$hash=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
[IO.File]::WriteAllText((Join-Path $projectRoot 'dist\SHA256.txt'),($hash+"  FGO-Solo-$version.apk"+[Environment]::NewLine))
Write-Output 'APK 资源路径及源码一致性检查通过。'
