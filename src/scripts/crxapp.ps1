$dev = "D:\dev\pseudoqurl\"
$source = $dev + "dist\capuchin_rel"
$destination = $dev + "assets"
$key = $dev + "key.pem"

set-alias chrome "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"  

chrome --pack-extension=$source --pack-extension-key=$key
Start-Sleep 3
Copy-Item $dev\dist\*.crx -Destination $destination -Force   
