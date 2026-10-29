$ErrorActionPreference = "SilentlyContinue"

$brainDir = Join-Path $env:USERPROFILE ".gemini\antigravity\brain"
if (-not (Test-Path $brainDir)) {
    Write-Host "❌ Could not locate Antigravity brain directory at: $brainDir" -ForegroundColor Red
    return
}

$sessions = Get-ChildItem -Directory $brainDir | ForEach-Object {
    $transcript = Join-Path $_.FullName ".system_generated\logs\transcript.jsonl"
    if (Test-Path $transcript) {
        [PSCustomObject]@{
            Id = $_.Name
            Transcript = $transcript
            Mtime = (Get-Item $transcript).LastWriteTime
        }
    }
} | Sort-Object Mtime -Descending

if (-not $sessions) {
    Write-Host "❌ No active session transcripts found." -ForegroundColor Red
    return
}

$active = $sessions[0]

$modelTurns = 0
$totalIn = 0
$totalCache = 0
$totalOut = 0
$recent = [System.Collections.Generic.List[PSCustomObject]]::new()

$reader = [System.IO.File]::OpenText($active.Transcript)
while (($line = $reader.ReadLine()) -ne $null) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.Contains('"PLANNER_RESPONSE"') -and $line.Contains('"input_tokens"')) {
        try {
            $obj = ConvertFrom-Json $line -ErrorAction SilentlyContinue
            if ($obj.source -eq "MODEL" -and $obj.type -eq "PLANNER_RESPONSE") {
                $modelTurns++
                $inp = [int]($obj.input_tokens)
                $cache = [int]($obj.cache_read_tokens)
                $out = [int]($obj.output_tokens)
                $totalIn += $inp
                $totalCache += $cache
                $totalOut += $out
                $ctx = $inp + $cache
                $recent.Add([PSCustomObject]@{
                    Step = $obj.step_index
                    Input = $inp
                    Cache = $cache
                    Output = $out
                    Context = $ctx
                })
                if ($recent.Count -gt 5) { $recent.RemoveAt(0) }
            }
        } catch {}
    }
}
$reader.Close()

$latest = if ($recent.Count -gt 0) { $recent[$recent.Count - 1] } else { [PSCustomObject]@{ Input = 0; Cache = 0; Output = 0; Context = 0 } }
$limit = 1000000
$pct = [math]::Round(($latest.Context / $limit) * 100, 1)
$cacheHit = if (($totalIn + $totalCache) -gt 0) { [math]::Round(($totalCache / ($totalIn + $totalCache)) * 100, 1) } else { 0 }

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "           🤖 ANTIGRAVITY AI TOKEN & CONTEXT TELEMETRY          " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "📌 Conversation ID    : $($active.Id)"
Write-Host "🧠 Active Context Size: $('{0:N0}' -f $latest.Context) / 1,000,000 tokens ($pct% of 1M limit)" -ForegroundColor Yellow
Write-Host "⚡ Prompt Cache Ratio : $cacheHit% cache hit rate across session" -ForegroundColor Green
Write-Host "----------------------------------------------------------------"
Write-Host "🎯 LATEST ITERATION BREAKDOWN:" -ForegroundColor Magenta
Write-Host "   • Fresh Input Tokens   : $('{0:N0}' -f $latest.Input) (new prompt + files + command output)"
Write-Host "   • Cached Context Tokens: $('{0:N0}' -f $latest.Cache) (reused from prompt cache)"
Write-Host "   • Model Output Tokens  : $('{0:N0}' -f $latest.Output) (reasoning + code generation)"
Write-Host "----------------------------------------------------------------"
Write-Host "📈 RECENT 5 ITERATIONS:" -ForegroundColor Yellow
foreach ($s in $recent) {
    $cPct = if ($s.Context -gt 0) { [math]::Round(($s.Cache / $s.Context) * 100) } else { 0 }
    Write-Host ("   Step #{0,-5} | Context: {1,8} tokens | Fresh In: {2,6} | Cached: {3,7} ({4}%) | Out: {5,5}" -f $s.Step, ('{0:N0}' -f $s.Context), ('{0:N0}' -f $s.Input), ('{0:N0}' -f $s.Cache), $cPct, $s.Output)
}
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

