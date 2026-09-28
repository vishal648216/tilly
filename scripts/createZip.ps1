$stagingDir = 'cpanel_bundle'
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
if (Test-Path 'taily_cpanel_upload.zip') { Remove-Item 'taily_cpanel_upload.zip' -Force }

New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null
New-Item -ItemType Directory -Path "$stagingDir\prisma" -Force | Out-Null
New-Item -ItemType Directory -Path "$stagingDir\public" -Force | Out-Null

# Copy production build (.next)
Copy-Item -Path '.next' -Destination "$stagingDir\.next" -Recurse -Force
# Copy source
Copy-Item -Path 'src' -Destination "$stagingDir\src" -Recurse -Force

# Copy database & prisma
Copy-Item -Path 'prisma\schema.prisma' -Destination "$stagingDir\prisma\schema.prisma" -Force
Copy-Item -Path 'taily_database_backup.db' -Destination "$stagingDir\prisma\dev.db" -Force
Copy-Item -Path 'taily_database_backup.db' -Destination "$stagingDir\taily_database_backup.db" -Force
Copy-Item -Path 'taily_database_dump.sql' -Destination "$stagingDir\taily_database_dump.sql" -Force

# Copy configs & startup
Copy-Item -Path 'package.json' -Destination "$stagingDir\package.json" -Force
Copy-Item -Path 'package-lock.json' -Destination "$stagingDir\package-lock.json" -Force
Copy-Item -Path 'server.js' -Destination "$stagingDir\server.js" -Force
Copy-Item -Path '.env' -Destination "$stagingDir\.env" -Force
Copy-Item -Path 'next.config.mjs' -Destination "$stagingDir\next.config.mjs" -Force
Copy-Item -Path 'tailwind.config.ts' -Destination "$stagingDir\tailwind.config.ts" -Force
Copy-Item -Path 'postcss.config.js' -Destination "$stagingDir\postcss.config.js" -Force
Copy-Item -Path 'tsconfig.json' -Destination "$stagingDir\tsconfig.json" -Force
Copy-Item -Path 'CPANEL_DEPLOYMENT_GUIDE.md' -Destination "$stagingDir\CPANEL_DEPLOYMENT_GUIDE.md" -Force

Write-Host "Compressing cpanel_bundle to taily_cpanel_upload.zip..."
Compress-Archive -Path "$stagingDir\*" -DestinationPath "taily_cpanel_upload.zip" -CompressionLevel Optimal -Force

Remove-Item $stagingDir -Recurse -Force

$file = Get-Item "taily_cpanel_upload.zip"
$mb = [math]::Round($file.Length / 1MB, 2)
Write-Host "SUCCESS: taily_cpanel_upload.zip created ($mb MB)"
