$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node "$scriptDir\bin\win-php.js" @args
