$tgtdir = '../amplitude_heroku'

$env:NODE_ENV = "production"
npm run mkapp
$env:NODE_ENV = "development"

$ScriptPath = Split-Path $MyInvocation.InvocationName
& "$ScriptPath\zipapp.ps1"
& "$ScriptPath\tgzapp.ps1"

# NB - the assets, dist, dist/server, dist/lib directories are all assumed to exist
Copy-Item package.json -Destination $tgtdir -Force   
Copy-Item dist/server -Destination $tgtdir/dist -Recurse -Force -Exclude *.map
Copy-Item dist/lib -Destination $tgtdir/dist -Recurse -Force -Exclude *.map
Copy-Item assets/synereo-plugin.zip -Destination $tgtdir/assets 
Copy-Item assets/synereo-plugin.tar.gz -Destination $tgtdir/assets 
Copy-Item assets/index.htmpl -Destination $tgtdir/assets 
Copy-Item .env.rel.example -Destination $tgtdir/.env.example 

