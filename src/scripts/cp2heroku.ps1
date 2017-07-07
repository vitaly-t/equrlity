$nodeEnv = If ($args[0] -eq "staging") {"staging"} Else {"production"}
$tgtdir = If ($nodeEnv -eq "staging") {"../pseudoqurl-staging"} Else {"../pseudoqurl_heroku"}
$srcdir = If ($nodeEnv -eq "staging") {"staging"} Else {"rel"}

$env:NODE_ENV = $nodeEnv
npm run mkapp
npm run mkbndls
$env:NODE_ENV = "development"

If ($nodeEnv -eq "production") {
  $ScriptPath = Split-Path $MyInvocation.InvocationName
  & "$ScriptPath\zipapp.ps1"
  # & "$ScriptPath\tgzapp.ps1"
  # & "$ScriptPath\crxapp.ps1"
}

# NB - the assets, dist, dist/server, dist/lib, dist/gen directories are all assumed to exist
Copy-Item package.json -Destination $tgtdir -Force   
Copy-Item dist/server -Destination $tgtdir/dist -Recurse -Force -Exclude *.map
Copy-Item dist/lib -Destination $tgtdir/dist -Recurse -Force -Exclude *.map
Copy-Item dist/gen -Destination $tgtdir/dist -Recurse -Force -Exclude *.map
Copy-Item dist/$srcdir/*_bndl.js -Destination $tgtdir/dist -Force
Copy-Item .env -Destination $tgtdir/.env 
If ($nodeEnv -eq "production") {
  Copy-Item assets/* -Destination $tgtdir/assets -Force
}
