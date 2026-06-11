# Downloads RootEncoder 2.7.2 AARs into android/local-maven (offline Gradle builds).
$ErrorActionPreference = 'Stop'
$base = Join-Path $PSScriptRoot '..\android\local-maven'
$version = '2.7.2'
$modules = @('library', 'encoder', 'rtmp', 'common', 'rtsp', 'srt', 'udp')

foreach ($m in $modules) {
  $dir = Join-Path $base "com\github\pedroSG94\RootEncoder\$m\$version"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $aar = "https://www.jitpack.io/com/github/pedroSG94/RootEncoder/$m/$version/$m-$version.aar"
  $pom = "https://www.jitpack.io/com/github/pedroSG94/RootEncoder/$m/$version/$m-$version.pom"
  Write-Host "Fetching $m..."
  Invoke-WebRequest -Uri $aar -OutFile (Join-Path $dir "$m-$version.aar") -UseBasicParsing
  Invoke-WebRequest -Uri $pom -OutFile (Join-Path $dir "$m-$version.pom") -UseBasicParsing
}

Write-Host "Done. RootEncoder AARs in android/local-maven"
