$source = "./dist/rel/capuchin"

$destination = "./assets/pseudoqurl-plugin.zip"

If (Test-path $destination) {Remove-item $destination}

Add-Type -assembly "system.io.compression.filesystem"

[io.compression.zipfile]::CreateFromDirectory($Source, $destination) 

