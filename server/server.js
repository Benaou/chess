const http = require('http');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');

// Rules - domain logic
const ChessGame = require('./chessgame.js');

// Websocket implementation
const encode = require('../lib/encoder.js');
const decode = require('../lib/decoder.js');

// Handling ports
const newPort = require('../lib/inputHandler.js');
const WebSocketPort = 8124;
const GameSessionPort = newPort() || 80;


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
	} while(takenIds.includes(boardStateId.toString()));
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
	if(!Object.keys(gameStateObj).includes(boardStateId.toString())) {
		createNewBoard(connObj);
		return;
	}
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
				c.end();
				if(gameStateObj[c.boardStateId]) {
					let connArr = gameStateObj[c.boardStateId].connArr;
					connArr.splice(c.connArrId,1);
					gameStateObj[c.boardStateId].connArrId--;
					console.log(`[data] decremented connArrId: ${gameStateObj[c.boardStateId].connArrId} from boardStateId: ${c.boardStateId}`);
					if(gameStateObj[c.boardStateId].connArrId == 0) { //no connections, just kill the game board
						delete gameStateObj[c.boardStateId];
						console.log(`[data] deleting ${c.boardStateId}`);
					}
				}
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

server.listen(WebSocketPort, () => { 
	console.log(`Port: ${WebSocketPort} -- [net] Websocket server `);
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
}).listen(GameSessionPort, () => {console.log(`Port: ${GameSessionPort} -- [http] Game session server `); });

