param(
    [string]$Serial,
    [ValidateRange(1, 65535)][int]$Port = 8081
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$adb = 'C:/Users/dell/AppData/Local/Android/Sdk/platform-tools/adb.exe'
if (-not (Test-Path -LiteralPath $adb)) { throw "ADB missing: $adb" }
$deviceOutput = & $adb devices
if ($LASTEXITCODE -ne 0) { throw 'adb devices failed.' }
$deviceOutput | Write-Output
$onlineDevices = @($deviceOutput | ForEach-Object {
    if ($_ -match '^(\S+)\s+device\s*$') { $Matches[1] }
})
if ($Serial) {
    if ($Serial -notin $onlineDevices) { throw "Device $Serial is not online. Unlock the phone and accept USB debugging." }
} elseif ($onlineDevices.Count -eq 1) {
    $Serial = $onlineDevices[0]
} else {
    throw 'Connect and authorize one Android device, or pass -Serial with an online device ID.'
}
& $adb -s $Serial reverse "tcp:$Port" "tcp:$Port"
if ($LASTEXITCODE -ne 0) { throw 'Metro USB forwarding failed.' }
Write-Output "Metro port $Port forwarded over USB for $Serial."
