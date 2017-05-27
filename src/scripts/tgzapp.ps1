$source = "./dist/rel/capuchin"
$destination = "./assets/pseudoqurl-plugin.tar.gz"

set-alias sz "D:\dev\tools\7za.exe"  
# create temp dir, copy all files into it etc
sz a -ttar temp.tar $source/*
sz a -tgzip $destination temp.tar

Remove-Item temp.tar