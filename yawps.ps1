$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node "$scriptDir\bin\yawps.js" @args
