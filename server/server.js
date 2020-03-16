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

var socketArr = [];
var socketId = 0;
var validIdArr = [];

var gameStateObj = {};
//var validGameStateIdArr = [];

function createNewBoard(connObj) {
	let boardStateId; //random 6 digit number (between 100000 and 999999)
	let takenIds = Object.keys(gameStateObj);
	do { //Not worried about multiple collisions slowing this part down, there's 900000 possible IDs
		boardStateId = 100000+Math.floor(900000*Math.random());
	} while(takenIds.includes(boardStateId));
	gameStateObj[boardStateId] = {
		'connArr': [],
		'game': new ChessGame(),
		'legalMoves': {'boardId':-1,'moves':[]},
		'connArrId': 0
	};
	console.log(`[createNewBoard] Created id ${boardStateId}. Keys: ${Object.keys(gameStateObj)}`);
	connObj.write(
		encode(
			JSON.stringify(
				{'type':'boardStateId',
				'data':boardStateId
				}
			)
		)
	);
	
}

function joinBoard(connObj, boardStateId) {
	connObj.boardStateId = boardStateId;
	gameStateObj[boardStateId].connArr.push(connObj);
	connObj.connArrId = gameStateObj[boardStateId].connArrId++;
	sendAll(gameStateObj[boardStateId].connArr,
		{
			'type':'board',
			'data':gameStateObj[boardStateId].game.getBoard()
		}
	);
}

function sendAll(connArr, data) {
	for(connObj of connArr) {
		connObj.write(
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
			c.write("HTTP/1.1 101 Switching Protocols\r\n\
Upgrade: websocket\r\n\
Connection: Upgrade\r\n\
Sec-WebSocket-Accept: "+crypto.createHash('sha1').update(data.toString()
						.split("Sec-WebSocket-Key: ")[1]
						.split("\r\n")[0]+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
						.digest('base64')
+"\r\n\r\n"
			);
		} else { //connection already accepted. data from client
			if((data[0]&0xF)==8) { //opcode to close connection
				console.log(`[data] client #${c.id} sent opcode 8 (close connection)`);
				delete socketArr[c.id];
				validIdArr = validIdArr.filter( x => x!=c.id );
				let connArr = gameStateObj[c.boardStateId].connArr;
				c.end();
				connArr.splice(c.connArrId);
				gameStateObj[c.boardStateId].connArrId--;
				/* if(!connArr[0] && !connArr[1]) { //both main players are gone!!
					for(connObj of connArr) {
						if(connObj!=undefined) {
							connObj.end();
						}
					}
					delete gameStateObj[c.boardStateId];
				} */
			} else { //real data, not close connection
				message = JSON.parse(decode(data));
				console.log(message);
				if(message.type == 'click') {
					let gameSessionObj = gameStateObj[c.boardStateId];
					let gameBoard = gameSessionObj.game;
					let turnInfo = gameBoard.getTurnInfo();
					let connArr = gameSessionObj.connArr;
					if(turnInfo.player == c.connArrId) {
						if(!gameSessionObj.legalMoves.moves.length) {
							gameSessionObj.legalMoves = gameBoard.generateLegalMoves(message.data);
							c.write(
								encode(
									JSON.stringify(
										{'type': 'highlight',
											'data': gameSessionObj.legalMoves.moves
										}
									)
								)
							);
						} else {
							let [newBoardStatus, flags] = gameBoard.move(gameSessionObj.legalMoves.boardId, message.data);
							console.log(`[server line 126] flags ${flags}`);
							sendAll(connArr,
								{'type': 'board',
									'data': newBoardStatus
								}
							);
							gameBoard.clearMoves();
						}
					}
				} else if(message.type == 'boardStateId') {
					console.log(`client #${c.id} request to join boardStateId: ${message.data}`);
					//implement if boardStateId exists and creating one if not
					if(message.data == 'new') {
						createNewBoard(c);
					} else {
						let boardStateId = parseInt(message.data);
						if(isNaN(boardStateId)) {
							createNewBoard(c);
						}
						joinBoard(c, boardStateId);
					}
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
//Uncomment the code if you want to create a specific structure for where to have the chess game provided
http.createServer((request, response) => { //simple http web server to host the client page (port 80)
	console.log(`[http] Received web request from ${response.socket.remoteAddress} for ${request.url}`);
	request.on('error', (err) => {
		console.error(err);
	});
	response.on('error', (err) => {
		console.error(err);
	});
	//if(request.url === '/') {
	fs.readFile('../client/multiplayer_chess.html', (err, data) => {
		response.writeHead(200, {'Content-Type': 'text/html'});
		response.write(data);
		response.end();
	});
	/*
	} else {
		response.statusCode = 404;
		response.end();
	}
	*/
}).listen(80);
