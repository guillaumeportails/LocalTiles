
// C:\Source\MUL\server.js
// Serveur HTTP local avec node.js (qui est installe dans C:\Progs\node.js) :
// Cf http://ericsowell.com/blog/2014/6/17/enough-node-for-building-a-simple-website
//
// Sert :
// + L'arbo de fichiers statiques ./map
// + Le contenu d'un MBTiles local, ou de OSM tuile si absent du MBTiles
//
// Usage :
// 		cmd.exe
//   		cd C:\Source\MUL
//		    npm install
//   		node server.js
// 		firefox
//			http://localhost:3000/map/
//			http://localhost:3000/tiles/10/1234/2345.png
//
// Cf:
// + http://expressjs.com/en/starter/static-files.html
// + On peut aussi utiliser python3 a la place de node.js :
//   python -m SimpleHTTPServer
//
// * ----------------------------------------------------------------------------
// *  "THE BEER-WARE LICENSE" (Revision 42):
// *  http://about.me/thierrybernier wrote this file. As long as you retain this
// *  notice you can do whatever you want with this stuff, but complain.
// *  If we meet some day, and you think this stuff is worth it, you can buy me
// *  a beer in return (cool, pale or lager preferred).
// * ----------------------------------------------------------------------------
// *
// * Based on node.js, cf https://github.com/nodejs/node/blob/master/LICENSE


/**************
const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World\n');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
**************/

var express = require('express');
var MBTiles = require('mbtiles');
var http    = require('http');
var https   = require('https');

const dbg = false;

var srvBoth = express();
var srvHtml = srvBoth;
var srvTile = srvBoth;

function clone(a) {
	return JSON.parse(JSON.stringify(a));
}


// Que faire des tuiles non trouvees localemenbt dans la base MBTiles ?
//  true  : redirect HTTP 302 vers un serveur Web
//  false : chargement direct depuis un serveur web
const redirect = false;

// URL alternative sur le Web pour une tuile non trouvee localement
function altUrl(z,x,y) {
	return "http://a.tile.opencyclemap.org/cycle"
	        + "/" + z + "/" + x + "/" + y + ".png";
}

// download de la tuile OSM (Zoom=z,Col=x,Row=y), utilise si on ne la trouve pas en local
// => Ca marche pas, remplace par un redirect()
//	?! Les headers ne transmettent pas content-length et content-type via callback 
//	?! Si on additionne des strings, la taille est plus grande que la normale
// => MOBAC ne traite pas le HTTP 302 redirection. TODO: le faire a sa place ...
// https://nodejs.org/api/stream.html#stream_readable_setencoding_encoding
function webTile(url, callback) {
    if (dbg) console.log('webTile  ' + url);
	http.get(url, function gotChunk (incoming) {		// Use the proper http or https object !
		// incoming est de type http.IncomingMessage qui implemente Readable Stream
		// cf https://nodejs.org/api/http.html#http_http_get_options_callback
		//console.log('incoming ' + JSON.stringify(incoming));
		// cf https://nodejs.org/api/stream.html
        incoming.setEncoding('binary');		// null, 'utf-8', 'binary' = alias de 'latin1'
		var rawData = '';
        incoming.on('data',  function(chunk) {	// chunk est un string
			//console.log("chunk " + typeof(chunk) + " " + chunk.length);
			rawData += chunk; /*rawData.push(chunk);*/ });
        incoming.on('error', function(e) {
			console.log(e); }); 
        incoming.on('end',   function() {
			//console.log('gotOSM  ' + url); // + ' bytes=' + rawData.length);
			//console.log(incoming.headers);
            callback(new Buffer(rawData, 'binary'), incoming.headers);
            });
		});
	};


//--------------------------------------------
// Servir les MBTiles aux URI /tiles/z/y/x.*
//
// TODO: chercher dans plusieurs bases MBTiles, puis dans le Web en dernier recours

var mbtFile = "C:/GIS/NZ/NZ_OTM_TA_NI.mbtiles";			// Zmax=?
var mbtFile = "C:/GIS/NZ/NZ_South_Island.mbtiles";		// Zmax=14
var mbtFile = "C:/GIS/NZ/NZ_caltopo_SI.mbtiles";		// Zmax=15
var mbtFile = "C:/GIS/NZ/NZcaltopo_TAocm.mbtiles";		// Zmax=12, mais 15 autour du TA

var mbts = new MBTiles(mbtFile, function(err, mbtiles) {
  if (dbg) console.log('Serving tiles from ' + mbtFile);
  if (err) { console.log("ERR " + err); throw err; }
  mbtiles.getInfo(function(err,info) {
	if (dbg) console.log("MBTfile " + mbtFile + " opened");
	if (err) console.log(err); else	console.log(info);
  });

  srvTile.get('/tiles/:z/:x/:y.:e', function(req, res, next) {
    if (dbg) console.log('MBTcbsta ' + req.method + ' ' + req.url);
    switch (req.params.e) {
      case "png": case "jpeg": {
        mbtiles.getTile(req.params.z, req.params.x, req.params.y, function(err, tile, headers) {
		if (dbg) console.log('SQLcbsta ' + 'L'+req.params.z+'X'+req.params.x+'Y'+req.params.y);
		if (err) {
			// Tuile absente de ce mbtFile : essai de remplacement par une tuile du Web
			var weburl = altUrl(req.params.z, req.params.x, req.params.y);
			if (redirect) {
				//console.log("Redirect " + weburl);
				res.redirect(weburl);
			} else {
				webTile(weburl, function(img,hdr) {
					//console.log("WEBcbsta img.length " + img.length);
					//console.log(hdr);
					var h2 = {'content-type': hdr['content-type'],
							  'etag': hdr['etag'],
							  'last-modified': 'Mon, 31 Oct 2016 16:16:45 GMT'}; //hdr['last-modified']};
					if (dbg) console.log(h2);
					res.header(h2);
					res.send(img); // res.json(JSON.stringify(img));
					if (dbg) console.log("WEBcbend img.length " + img.length);
				});
			}
        } else {
			if (dbg) console.log("tile.length " + tile.length + " type " + typeof(tile));
			if (dbg) console.log(headers);
            res.header(headers);
            res.send(tile);
		}
		if (dbg) console.log('SQLcbend ' + 'L'+req.params.z+'X'+req.params.x+'Y'+req.params.y);
		});
        break;
      }
      case "grid.json": {
        mbtiles.getGrid(req.params.z, req.params.x, req.params.y, function(err, grid, headers) {
          if (err) {
            res.status(404).send('Grid rendering error: ' + err + '\n');
          } else {
            res.header("Content-Type", "text/json");
            res.send(grid);
          }
        });
        break;
      }
    }
	//next();
    if (dbg) console.log('MBTcbend ' + req.method + ' ' + req.url);
 });
});

// Test de webTiles
// Rate: difference dans les headers par rapport un a tile server direct :
//	Connection: close							Absent sur le  tile server
//  Content-Type: image/png; charset=utf-8		charset absent sur le tile server
srvHtml.get('/shadow/:z/:x/:y.:e', function(req, res, next) {
    if (dbg) console.log('SHAget ' + req.method + ' ' + req.url + ' '); // + ' ' + req.header('Origin'));

	var weburl = altUrl(req.params.z, req.params.x, req.params.y);	
	webTile(weburl, function(img,hdr) {
		if (dbg) console.log("WEBsta img.length " + img.length + " type " + typeof(img));
		var h2 = JSON.parse(JSON.stringify(hdr));
		h2['content-type'] = 'image/png';
		delete h2['connection'];
		//h2 = { 'content-type': 'image/png', 'content-length': hdr['content-length'] }; 
		if (dbg) console.log(h2);
		res.header(h2);
		res.send(img);
		res.end();
		if (dbg) console.log("WEBend");
	});

	if (dbg) console.log("SHAend");
});


//--------------------------------------------
// Servir les fichiers de repertoire ./map a toutes les UROI /map/*

srvHtml.get('/map/', function(req, res, next) {
    if (dbg) console.log('MAP ' + req.method + ' ' + req.url + ' '); // + ' ' + req.header('Origin'));
	
	// Enable CORS :
	res.header("Access-Control-Allow-Origin", "*");
	res.header('Access-Control-Allow-Methods', "GET, OPTIONS, PUT, POST, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	if (dbg) console.log('    header ' + JSON.stringify(res.headers))
	
    next();
});

srvHtml.use('/map', express.static(__dirname + '/map'));



//--------------------------------------------
// actually create the server(s)

var portHtml = 3000;
srvHtml.listen(portHtml, function() {
  console.log(`Server running at http://localhost:${portHtml}/`);
  console.log('Serving statically files from ' + __dirname + '/map/');
  //console.log('! CORS enabled');
  if (srvHtml == srvTile) console.log('Serving tiles also');
});

if (srvTile != srvHtml) {
var portTile = 3001;
srvTile.listen(portTile, function() {
  console.log(`Server running at http://localhost:${portTile}/`);
  console.log('Serving tiles from MBTiles file');
});
}
