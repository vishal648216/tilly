Add-Type -AssemblyName System.IO.Compression.FileSystem

$tempId = Get-Random
$stagingDir = Join-Path $env:TEMP "taily123_$tempId"
$zipPath = "E:\pransh_project\taily\taily123.zip"
$sourceDir = "E:\pransh_project\taily"

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }

New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null
New-Item -ItemType Directory -Path "$stagingDir\prisma" -Force | Out-Null
New-Item -ItemType Directory -Path "$stagingDir\public" -Force | Out-Null
New-Item -ItemType Directory -Path "$stagingDir\scripts" -Force | Out-Null

Write-Host "Copying project files to temporary staging: $stagingDir..."

# Copy src using robocopy for fast, reliable copy
robocopy "$sourceDir\src" "$stagingDir\src" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
robocopy "$sourceDir\public" "$stagingDir\public" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
robocopy "$sourceDir\scripts" "$stagingDir\scripts" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

# Copy database & prisma
Copy-Item "$sourceDir\prisma\schema.prisma" "$stagingDir\prisma\schema.prisma" -Force
if (Test-Path "$sourceDir\prisma\seed.ts") { Copy-Item "$sourceDir\prisma\seed.ts" "$stagingDir\prisma\seed.ts" -Force }
if (Test-Path "$sourceDir\prisma\dev.db") { Copy-Item "$sourceDir\prisma\dev.db" "$stagingDir\prisma\dev.db" -Force }

# Copy configs & package files
Copy-Item "$sourceDir\package.json" "$stagingDir\package.json" -Force
Copy-Item "$sourceDir\package-lock.json" "$stagingDir\package-lock.json" -Force
if (Test-Path "$sourceDir\server.js") { Copy-Item "$sourceDir\server.js" "$stagingDir\server.js" -Force }
if (Test-Path "$sourceDir\next.config.mjs") { Copy-Item "$sourceDir\next.config.mjs" "$stagingDir\next.config.mjs" -Force }
if (Test-Path "$sourceDir\tailwind.config.ts") { Copy-Item "$sourceDir\tailwind.config.ts" "$stagingDir\tailwind.config.ts" -Force }
if (Test-Path "$sourceDir\postcss.config.js") { Copy-Item "$sourceDir\postcss.config.js" "$stagingDir\postcss.config.js" -Force }
if (Test-Path "$sourceDir\tsconfig.json") { Copy-Item "$sourceDir\tsconfig.json" "$stagingDir\tsconfig.json" -Force }
if (Test-Path "$sourceDir\README.md") { Copy-Item "$sourceDir\README.md" "$stagingDir\README.md" -Force }
if (Test-Path "$sourceDir\TESTING_GUIDE.md") { Copy-Item "$sourceDir\TESTING_GUIDE.md" "$stagingDir\TESTING_GUIDE.md" -Force }

# Generate sanitized, test-ready .env (NO sensitive production credentials or Postgres URLs)
$cleanEnvContent = @"
NODE_ENV=development
AUTH_SECRET=taily-secure-test-secret-key-32-chars-long-2026
DATABASE_URL="file:./dev.db"
ALLOW_DEV_AUTO_SEED=false
"@
Set-Content -Path "$stagingDir\.env" -Value $cleanEnvContent -Encoding UTF8
Set-Content -Path "$stagingDir\.env.example" -Value $cleanEnvContent -Encoding UTF8

Write-Host "Creating archive: $zipPath..."
[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)

# Clean up temp
Remove-Item $stagingDir -Recurse -Force -ErrorAction SilentlyContinue

$file = Get-Item $zipPath
$mb = [math]::Round($file.Length / 1MB, 2)
Write-Host "SUCCESS: $zipPath created successfully! Size: $mb MB"
