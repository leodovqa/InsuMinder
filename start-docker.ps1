# Auto-resolve Docker in PATH if installed recently in user session
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    $dockerPaths = @(
        "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin",
        "$env:ProgramFiles\Docker\Docker\resources\bin"
    )
    foreach ($p in $dockerPaths) {
        if (Test-Path "$p\docker.exe") {
            $env:PATH = "$p;$env:PATH"
            break
        }
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker was not found. Please ensure Docker Desktop is running or restart your terminal."
    exit 1
}

Write-Host "Starting InsuMinder (Client + Server) via Docker Compose..." -ForegroundColor Cyan
docker compose up --build
