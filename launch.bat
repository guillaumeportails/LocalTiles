
REM npm install

START "Local HTTP server" /MIN /D "C:\Source\MUL" node server.js

START "Browser" /B "C:\Program Files\Mozilla Firefox\firefox.exe" "http://localhost:3000/map"

REM http://localhost:3000/tiles/12/4030/2563.png
REM http://localhost:3000/map
REM http://localhost:3000/tiles/9/504/323.png
REM http://localhost:3000/tiles/17/128525/81839.png
