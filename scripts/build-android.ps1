$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version=(Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
if($version -notmatch '^\d+\.\d+\.\d+$'){throw 'package.json 版本号格式错误。'}
[xml]$manifest=Get-Content -LiteralPath (Join-Path $projectRoot 'android\AndroidManifest.xml') -Raw
if($manifest.manifest.GetAttribute('versionName','http://schemas.android.com/apk/res/android') -ne $version){throw 'Android 与 package.json 版本号不一致。'}
$releaseConfig=Get-Content -LiteralPath (Join-Path $projectRoot 'src\release-config.js') -Raw
if($releaseConfig -notmatch ('version:\s*"'+[regex]::Escape($version)+'"')){throw '应用显示版本与 APK 版本不一致。'}
$workspaceRoot=Split-Path $projectRoot -Parent
$environmentRoot=Join-Path $workspaceRoot '开发安装\环境'
$jdkRoot=(Get-ChildItem -LiteralPath (Join-Path $environmentRoot 'jdk') -Directory | Select-Object -First 1).FullName
$toolsRoot=Join-Path $environmentRoot 'android-sdk\build-tools\android-15'
$androidJar=(Get-ChildItem -LiteralPath (Join-Path $environmentRoot 'android-sdk\platforms') -Filter android.jar -Recurse | Select-Object -First 1).FullName
if(!$jdkRoot -or !$androidJar){throw 'Android SDK/JDK 未安装。'}
$buildRoot=Join-Path $projectRoot 'android\build'
$assetRoot=Join-Path $buildRoot 'assets'
$classesRoot=Join-Path $buildRoot 'classes'
$dexRoot=Join-Path $buildRoot 'dex'
$genRoot=Join-Path $buildRoot 'generated'
$distRoot=Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Force -Path $buildRoot,$assetRoot,$classesRoot,$dexRoot,$genRoot,$distRoot | Out-Null
# Clear only generated directories inside this project's build folder.
foreach($generated in @($assetRoot,$classesRoot,$dexRoot,$genRoot)){
  $resolved=[IO.Path]::GetFullPath($generated)
  if(!$resolved.StartsWith($buildRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw '无效的构建清理路径。'}
  Get-ChildItem -LiteralPath $resolved -Force | Remove-Item -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'index.html') -Destination $assetRoot -Force
foreach($dir in @('src','public')){Copy-Item -LiteralPath (Join-Path $projectRoot $dir) -Destination $assetRoot -Recurse -Force}
function Invoke-Checked {param([string]$Exe,[string[]]$Arguments) & $Exe @Arguments; if($LASTEXITCODE -ne 0){throw "构建失败：$Exe (exit $LASTEXITCODE)"}}
Set-Location -LiteralPath $projectRoot
Copy-Item -LiteralPath $androidJar -Destination (Join-Path $buildRoot 'android.jar') -Force
$resourceZip='android/build/resources.zip'
Invoke-Checked (Join-Path $toolsRoot 'aapt2.exe') @('compile','--dir','android/res','-o',$resourceZip)
$unsigned=Join-Path $buildRoot 'unsigned.apk'
Invoke-Checked (Join-Path $toolsRoot 'aapt2.exe') @('link','-o','android/build/unsigned.apk','-I','android/build/android.jar','--manifest','android/AndroidManifest.xml','--java','android/build/generated',$resourceZip)
$javaFiles=@(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'android\src'),$genRoot -Filter '*.java' -Recurse | ForEach-Object FullName)
Invoke-Checked (Join-Path $jdkRoot 'bin\javac.exe') (@('-encoding','UTF-8','-source','8','-target','8','-classpath',$androidJar,'-d',$classesRoot)+$javaFiles)
$classesJar=Join-Path $buildRoot 'classes.jar'
Invoke-Checked (Join-Path $jdkRoot 'bin\jar.exe') @('cf',$classesJar,'-C',$classesRoot,'.')
Invoke-Checked (Join-Path $jdkRoot 'bin\java.exe') @('-cp',(Join-Path $toolsRoot 'lib\d8.jar'),'com.android.tools.r8.D8','--min-api','26','--lib',$androidJar,'--output',$dexRoot,$classesJar)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::Open($unsigned,[IO.Compression.ZipArchiveMode]::Update)
try {
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $dexRoot 'classes.dex'),'classes.dex',[IO.Compression.CompressionLevel]::Optimal) | Out-Null
  # Add assets explicitly: Windows aapt2 can emit backslashes in ZIP entry names.
  foreach($file in Get-ChildItem -LiteralPath $assetRoot -File -Recurse){
    $relative=$file.FullName.Substring($assetRoot.Length+1).Replace('\','/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,('assets/'+$relative),[IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {$zip.Dispose()}
$aligned=Join-Path $buildRoot 'aligned.apk'
Invoke-Checked (Join-Path $toolsRoot 'zipalign.exe') @('-f','-p','4','android/build/unsigned.apk','android/build/aligned.apk')
$keyRoot=Join-Path $projectRoot 'android\signing'
New-Item -ItemType Directory -Force -Path $keyRoot | Out-Null
$key=Join-Path $keyRoot 'local-development.p12'
if(!(Test-Path -LiteralPath $key)){Invoke-Checked (Join-Path $jdkRoot 'bin\keytool.exe') @('-genkeypair','-keystore',$key,'-storepass','android','-keypass','android','-alias','fgo-solo-local','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=FGO Solo Local Development, O=Local, C=CN','-storetype','PKCS12')}
$apk=Join-Path $distRoot ("FGO-Solo-$version.apk")
Invoke-Checked (Join-Path $jdkRoot 'bin\java.exe') @('-jar',(Join-Path $toolsRoot 'lib\apksigner.jar'),'sign','--ks',$key,'--ks-pass','pass:android','--key-pass','pass:android','--out',$apk,$aligned)
Invoke-Checked (Join-Path $jdkRoot 'bin\java.exe') @('-jar',(Join-Path $toolsRoot 'lib\apksigner.jar'),'verify','--verbose',$apk)
Get-FileHash -LiteralPath $apk -Algorithm SHA256 | Format-List
Write-Output "APK: $apk"
& (Join-Path $PSScriptRoot 'verify-apk.ps1')
