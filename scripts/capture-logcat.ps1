# Снимает logcat WAAF Streamer при нажатии «ЭФИР».
# Требуется: USB-отладка на телефоне, platform-tools (adb).
$adb = "F:\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  $adb = "adb"
}
& $adb devices
Write-Host "Очистка logcat… Нажмите ЭФИР на телефоне. Ctrl+C для остановки."
& $adb logcat -c
& $adb logcat -s WaafLivestream:* AndroidRuntime:E System.err:W
