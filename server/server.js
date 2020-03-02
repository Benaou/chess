const http = require('http');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const ChessGame = require('./chessgame.js');

// ------------------ WebSocket implementation ----------------//

function decode(buffer) { //Decode WebSocket packets
	if(buffer[0]&0x80){} //first bit = FIN bit
	switch(buffer[0]&0xF) { //opcode
		case 0: //continuation frame
			//console.log("OPCODE 0x0: Continuation frame");
			break;
		case 1: //text frame
			//console.log("OPCODE 0x1: Text frame");
			break;
		case 2: //binary frame
			//console.log("OPCODE 0x2: Binary frame");
			break;
		case 8: //close connection
			//console.log("OPCODE 0x8: Close connection");
			break;
		case 9: //ping, send back opcode 10 with same payload to pong
			//console.log("OPCODE 0x9: Ping");
			break;
		case 10: //pong
			//console.log("OPCODE 0xA: Pong");
			break;
		default: //all other codes are unused
			break;
	}
	if(buffer[1]&0x80) {
		//console.log("Mask bit enabled");
	} //mask bit

	let length = buffer[1]&0x7F; //payload length if it's less than 126
	//console.log("Payload length: " + length.toString());
	let index = 2;
	if(length == 126) { //payload length is 126, meaning read the next 16 bits for the length
		length = (buffer[2]<<8)+buffer[3];
		index += 2;
		//console.log("Actual length after 126 case: " + length.toString());
	} else if(length == 127) {
		length = 0;
		for(let i=0; i<8; i++)
			length += buffer[2+i]<<(8*(7-i));
		index += 8;
		//console.log("Actual length after 127 case: " + length.toString());
	}
	var MASK = buffer.slice(index,index+4);
	var ENCODED = buffer.slice(index+4,index+4+length);
	//console.log("MASK: " + JSON.stringify(MASK));
	//console.log("ENCODED: " + JSON.stringify(ENCODED));
	var DECODED = new Array(length);
	DECODED.fill(0);
	for(var i = 0; i< ENCODED.length; i++)
		DECODED[i] = ENCODED[i] ^ MASK[i % 4];
	//console.log("DECODED: " + JSON.stringify(DECODED));
	return DECODED.map(c=>String.fromCharCode(c)).join('');
}

function encode(data) { //Encode WebSocket packets
	let length = data.length;
	let charCodeArray = data.split("").map(c => c.charCodeAt(0));
	if(length < 126) {
		return Buffer.from([0x81, length, ...charCodeArray]);
	} else if(length <= 2**16) { //set the length to 126 and set the next two bytes as the actual length
		return Buffer.from([0x81, 126, (0xFF00 & length)>>8, 0xFF & length, ...charCodeArray]);
	} else {
		//for the implemenation of this chess server, I will ensure it never gets this large
	}
}


var game = new ChessGame();
var legalMoves={'boardId':-1,'moves':[]};
var socketArr = [];
var socketId = 0;
var validIdArr = [];

function sendAll(data) {
	for(validId of validIdArr) {
		socketArr[validId].write(
			encode(
				JSON.stringify(data)
			)
		);
	}
}

const server = net.createServer((c) => { //create WebSocket server
	c.id = socketId;
	validIdArr.push(socketId);
	//c.paired = false;
	//c.connId = -1;
	socketArr[socketId++] = c;
	console.log(`[net] client #${c.id} connected (${c.remoteAddress})`);
	c.on('data', (data) => { //data is received (note that the data may appear in two separate .on('data') instances if it's too large ???)
		if(data.toString().startsWith("GET / HTTP/1.1")) { //upgrade connection on initial connection
			console.log(data.toString());
			c.write("HTTP/1.1 101 Switching Protocols\r\n\
Upgrade: websocket\r\n\
Connection: Upgrade\r\n\
Sec-WebSocket-Accept: "+crypto.createHash('sha1').update(data.toString()
						.split("Sec-WebSocket-Key: ")[1]
						.split("\r\n")[0]+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
						.digest('base64')
+"\r\n\r\n"
			);

			sendAll(
				{
					'type':'board',
					'data':game.getBoard()
				}
			);
		} else { //connection already accepted. data from client
			if((data[0]&0xF)==8) { //opcode to close connection
				console.log(`[data] client #${c.id} sent opcode 8 (close connection)`);
				delete socketArr[c.id];
				validIdArr = validIdArr.filter( x => x!=c.id );
				c.end();
			} else { //real data, not close connection
				message = JSON.parse(decode(data));
				console.log(message);
				if(message.type == 'click') {
					if(!legalMoves.moves.length) {
						legalMoves = game.generateLegalMoves(message.data);
						sendAll(
							{
								'type': 'highlight',
								'data': legalMoves.moves
							}
						);
					} else {
						let [newBoardStatus, flags] = game.move(legalMoves.boardId, message.data);
						console.log(`[server line 126] flags ${flags}`);
						sendAll(
							{
								'type': 'board',
								'data': newBoardStatus
							}
						);
						game.clearMoves();
					}
				} else if(message.type == 'reset') {
					console.log(`client #${c.id} reset request`);
					game = new ChessGame();
					sendAll(
						{
							'type':'board',
							'data':game.getBoard()
						}
					);
				}
			}
		}
	}).on('end', () => {
		console.log(`[net] client disconnected`);
	});
});
server.on('error', (err) => {
	throw err;
});
server.listen(8124, () => {
	console.log('[net] server bound on port 8124');
});


// ------------------ Web server implementation ----------------//
http.createServer((request, response) => { //simple http web server to host the client page (port 80)
	console.log(`[http] Received web request from ${response.socket.remoteAddress} for ${request.url}`);
	request.on('error', (err) => {
		console.error(err);
	});
	response.on('error', (err) => {
		console.error(err);
	});
	if(request.url === '/') {
		fs.readFile('index.html', (err, data) => {
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.write(data);
			response.end();
		});
	} else if(request.url.startsWith('/tetris/')) {
		if(request.url.includes('..')) {
			response.writeHead(403);
			resposne.end();
		} else {
			try {
				fs.readFile('..' + request.url, (err, data) => {
				response.writeHead(200, {'Content-Type': 'text/html'});
				response.write(data);
				response.end();
				});
			}
			catch(e) {
				response.writeHead(404);
				response.end();
				console.log(e);
			}
		}
	} else if(request.url === '/snake') {
			fs.readFile('../snake.html', (err, data) => {
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.write(data);
			response.end();
		});
	} else if(request.url.startsWith('/minesweeper')) {
		if(request.url.includes('..')) {
			response.writeHead(403);
			resposne.end();
		} else {
			try {
				fs.readFile('..' + request.url, (err, data) => {
				//response.writeHead(200, {'Content-Type': 'text/html'});
				response.write(data);
				response.end();
				});
			}
			catch(e) {
				response.writeHead(404);
				response.end();
				console.log(e);
			}
		}
	} else if(request.url === '/chess') {
			fs.readFile('../chess/multiplayer_chess.html', (err, data) => {
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.write(data);
			response.end();
		});
	} else {
		response.statusCode = 404;
		response.end();
	}
}).listen(80);