$source = "./dist/capuchin_rel"
$destination = "./assets/synereo-plugin.tar.gz"

set-alias sz "D:\dev\tools\7za.exe"  

sz a -ttar temp.tar $source/*
sz a -tgzip $destination temp.tar