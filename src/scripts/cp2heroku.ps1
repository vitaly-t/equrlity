$tgtdir = '../pseudoqurl_heroku'

$env:NODE_ENV = "production"
npm run mkapp
npm run mkbndls
$env:NODE_ENV = "development"

$ScriptPath = Split-Path $MyInvocation.InvocationName
& "$ScriptPath\zipapp.ps1"
& "$ScriptPath\tgzapp.ps1"
# & "$ScriptPath\crxapp.ps1"

# NB - the assets, dist, dist/server, dist/lib, dist/gen directories are all assumed to exist
Copy-Item package.json -Destination $tgtdir -Force   
Copy-Item dist/server -Destination $tgtdir/dist -Recurse -Force -Exclude *.map
Copy-Item dist/lib -Destination $tgtdir/dist -Recurse -Force -Exclude *.map
Copy-Item dist/gen -Destination $tgtdir/dist -Recurse -Force -Exclude *.map
Copy-Item dist/rel/*_bndl.js -Destination $tgtdir/dist -Force
Copy-Item assets/* -Destination $tgtdir/assets -Force
Copy-Item .env.rel.example -Destination $tgtdir/.env.example 

