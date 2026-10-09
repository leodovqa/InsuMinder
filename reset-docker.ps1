# One-Click Fresh Re-setup of InsuMinder (Deletes old containers, images, and volumes, then rebuilds)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$scriptDir\start-docker.ps1" -Reset

