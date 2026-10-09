param(
    [switch]$Reset
)

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

if ($Reset) {
    Write-Host "Re-setting up: Removing old containers, volumes, and local images..." -ForegroundColor Yellow
    docker compose down --volumes --rmi local --remove-orphans
    Write-Host "Building fresh containers and starting InsuMinder..." -ForegroundColor Cyan
    docker compose up --build
} else {
    Write-Host "Starting InsuMinder (Client + Server) via Docker Compose..." -ForegroundColor Cyan
    docker compose up --build
}
