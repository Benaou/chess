//Chess implementation for a server to keep track of the chess game

/*
Unicode 
2654 = white king
2655 = white queen
2656 = white rook
2657 = white bishop
2658 = white knight
2659 = white pawn

265A = black king
265B = black queen
265C = black rook
265D = black bishop
265E = black knight
265F = black pawn

Pieces are encoded by the last hexadecimal digit for simplicity (add 0x2650 to get unicode in chess client)
*/

const WHITE_KING = 0x2654;
const WHITE_QUEEN = 0x2655;
const WHITE_ROOK = 0x2657;
const WHITE_BISHIP = 0x2658;
const WHITE_KNIGHT = 0x2659;
const WHITE_PAWN = 0x2660;
const BLACK_LOW = 0x4;
const BLACK_HIGH = 0x9;

const BLACK_KING = 0x265A;
const BLACK_QUEEN = 0x265B;
const BLACK_ROOK = 0x265C;
const BLACK_BISHIP = 0x265D;
const BLACK_KNIGHT = 0x265E;
const BLACK_PAWN = 0x265F;
const BLACK_LOW = 0xA;
const BLACK_HIGH = 0xF;


//Helper functions that don't need to be exported

function getBoardId(boardX, boardY) {
	return boardX+8*boardY;
}

function getBoardCoord(boardId) {
	return [boardId%8, Math.floor(boardId/8)];
}

function coord2notation(boardX, boardY) {
	return String.fromCharCode(97+boardX)+(8-boardY).toString();
}

function piece2notation(pieceId) {
	return ['K', 'Q', 'R', 'B', 'N', ''][(pieceId-4)%6];
}

function isWhite(pieceId) {
	return (pieceId >= WHITE_LOW) && (pieceId <= WHITE_HIGH);
}

function isBlack(pieceId) {
	return (pieceId >= BLACK_LOW) && (pieceId <= BLACK_HIGH);
}

function getColor(pieceId) {
	if(isWhite(pieceId)) {
		return 0; //0 is white
	} else if(isBlack(pieceId)) {
		return 1; //1 is black
	} else {
		return -1; //empty board (or invalid pieceId)
	}
}

module.exports = class ChessGame {	
	//This class is meant to be used as an Object for creating and manipulating a game of chess
	constructor() {
		this.board = [
			0xC, 0xE, 0xD, 0xB, 0xA, 0xD, 0xE, 0xC,
			0xF, 0xF, 0xF, 0xF, 0xF, 0xF, 0xF, 0xF,
			0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
			0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
			0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
			0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
			0x9, 0x9, 0x9, 0x9, 0x9, 0x9, 0x9, 0x9,
			0x6, 0x8, 0x7, 0x5, 0x4, 0x7, 0x8, 0x6
		];
		this.turnInfo = {'player':0, 'turns':0}; //player = 0 is white, 1 is black
		this.turnLog = [];
		this.legalMoves = {'boardId':-1, 'moves':[]}; //legalMoves refers to the moves that the piece on boardId can make
		//legalMoves also refers to the last click, so if moves is not [] it indicates a move is available to be made
		// in the next click. Use generateLegalMoves to populate the moves list and then use the move function to adjust
		// the actual board
	}
	
	generateLegalMoves(boardId) { //use this whenever they use the first click
		let [boardX, boardY] = getBoardCoord(boardId);
		let pieceId = this.board[boardId];
		this.legalMoves.boardId = boardId;
		if(getColor(pieceId) == this.turnInfo.player) {
			this.legalMoves.moves = this.getLegalMoves(boardX, boardY, this.board);
		} else {
			this.legalMoves.moves = [];
		}
		return this.legalMoves;
	}
	
	getBoard() {
		return this.board;
	}
	
	getAllMoves(board, legal=false) {
		let moves=[];
		for(let i=0; i<64; i++) {
			let [x,y] = getBoardCoord(i);
			if(legal) {
				moves.push(this.getLegalMoves(x, y, board));
			} else {
				moves.push(this.generateMoves(x, y, board));
			}
		}
		return moves;
	}
	
	isCheckmate(board) {
		let allLegalMoves = this.getAllMoves(board, true);
		if(!allLegalMoves.some((moves, index) => {
			if(isBlack(board[index])) {
				return moves.length>0;
			} else {
				return false;
			}
		})) return 'black';
		
		if(!allLegalMoves.some((moves, index) => {
			if(isWhite(board[index])) {
				return moves.length>0;
			} else {
				return false;
			}
		})) return 'white';
		return false;
	}
	
	whiteCheck(board) {
		return this.getAllMoves(board).some(m=>m.some(id=>board[id]==0x4));
	}

	blackCheck(board) {
		return this.getAllMoves(board).some(m=>m.some(id=>board[id]==0xA));
	}
	
	getLegalMoves(boardX, boardY, board) {
		let boardId = getBoardId(boardX, boardY);
		let moves = this.generateMoves(boardX, boardY, board);
		if(moves.includes(62) && boardId==60 && board[boardId]==0x4) { //white king castling
			if(this.getAllMoves(boardState)
				.filter( (_,index) => isBlack(board[index]) )
				.some( (moves) => moves.some( (move) => [60,61,62].includes(move)) )
			) { //ensure king doesn't cross any attacked spaces (and isn't already in check)
				moves = moves.filter( (id) => id!=62 );
			}
		}
		if(moves.includes(58) && boardId==60 && board[boardId]==0x4) { //white king castling on queen's side
			if(this.getAllMoves(boardState)
				.filter( (_,index) => isBlack(board[index]) )
				.some( (moves) => moves.some( (move) => [58,59,60].includes(move)) )
			) { //ensure king doesn't cross any attacked spaces (and isn't already in check)
				moves = moves.filter( (id) => id!=58 );
			}
		}
		if(moves.includes(6) && boardId==4 && board[boardId]==0xA) { //black king castling
			if(this.getAllMoves(boardState)
				.filter( (_,index) => isWhite(board[index]) )
				.some( (moves) => moves.some( (move) => [4,5,6].includes(move)) )
			) { //ensure king doesn't cross any attacked spaces (and isn't already in check)
				moves = moves.filter( (id) => id!=6 );
			}
		}
		if(moves.includes(2) && boardId==4 && board[boardId]==0xA) { //black king castling on queen's side
			if(this.getAllMoves(boardState)
				.filter( (_,index) => isWhite(board[index]) )
				.some( (moves) => moves.some( (move) => [2,3,4].includes(move)) )
			) { //ensure king doesn't cross any attacked spaces (and isn't already in check)
				moves = moves.filter( (id) => id!=2 );
			}
		}
		return moves.filter( (id) => {
			let tempBoard = Array.from(board);
			tempBoard[id] = tempBoard[boardId];
			tempBoard[boardId] = 0x0;
			return !(isWhite(board[boardId])?this.whiteCheck(tempBoard):this.blackCheck(tempBoard));
		});
	}
	
	generateMoves(boardX, boardY, board=this.board) {
		let boardId = getBoardId(boardX, boardY);
		let piece = board[boardId];
		let moves = [];
		let lastMove = this.turnLog[this.turnLog.length-1];
		switch(piece) {
		case 0xF: //black pawn
			if(boardY+1 < 8) {
				if(board[getBoardId(boardX,boardY+1)]==0) {
					moves.push(getBoardId(boardX,boardY+1));
					if(boardY==1) {
						if(board[getBoardId(boardX,boardY+2)]==0)
							moves.push(getBoardId(boardX,boardY+2));
					}
				}
				if(boardX<7 && boardY<7) {
					if(isWhite(board[getBoardId(boardX+1,boardY+1)])) {
						moves.push(getBoardId(boardX+1,boardY+1));
					}
					if(lastMove && boardY==4) {
						if( lastMove.oldPieces[0]==0x9 && lastMove.boardIds[0]==getBoardId(boardX+1,6) && lastMove.boardIds[1]==getBoardId(boardX+1,4)) {
							moves.push(getBoardId(boardX+1,boardY+1));
						}
					}

				}
				if(boardX>0 && boardY<7) {
					if(isWhite(board[getBoardId(boardX-1,boardY+1)])) {
						moves.push(getBoardId(boardX-1,boardY+1));
					}
					if(lastMove && boardY==4) {
						if( lastMove.oldPieces[0]==0x9 && lastMove.boardIds[0]==getBoardId(boardX-1,6) && lastMove.boardIds[1]==getBoardId(boardX-1,4)) {
							moves.push(getBoardId(boardX-1,boardY+1));
						}
					}
				}
			}
			break;
		case 0x9: //white pawn
			if(boardY-1 >= 0) {
				if(board[getBoardId(boardX,boardY-1)]==0) {
					moves.push(getBoardId(boardX,boardY-1));
					if(boardY==6) {
						if(board[getBoardId(boardX,boardY-2)]==0)
							moves.push(getBoardId(boardX,boardY-2));
					}
				}
				if(boardX<7 && boardY>0) {
					if(isBlack(board[getBoardId(boardX+1,boardY-1)])) {
						moves.push(getBoardId(boardX+1,boardY-1));
					}
					if(lastMove && boardY==3) {
						if( lastMove.oldPieces[0]==0xF && lastMove.boardIds[0]==getBoardId(boardX+1,1) && lastMove.boardIds[1]==getBoardId(boardX+1,3)) {
							moves.push(getBoardId(boardX+1,boardY-1));
						}
					}
				}
				if(boardX>0 && boardY>0) {
					if(isBlack(board[getBoardId(boardX-1,boardY-1)])) {
						moves.push(getBoardId(boardX-1,boardY-1));
					}
					if(lastMove && boardY==3) {
						if( lastMove.oldPieces[0]==0xF && lastMove.boardIds[0]==getBoardId(boardX-1,1) && lastMove.boardIds[1]==getBoardId(boardX-1,3)) {
							moves.push(getBoardId(boardX-1,boardY-1));
						}
					}
				}
			}
			break;
		case 0xE: //black knight
			for(let t=-2; t<=2; t+=4) { //this replaces the number 2 and -2, fight me
				for(let o=-1; o<=1; o+=2) { //this replaces the number 1 and -1, also fight me
					if((boardX+t>=0 && boardX+t<8) && (boardY+o>=0 && boardY+o<8)) {
						if(isWhite(board[getBoardId(boardX+t,boardY+o)]) || board[getBoardId(boardX+t,boardY+o)]==0) {
							moves.push(getBoardId(boardX+t,boardY+o));
						}
					}
					if((boardX+o>=0 && boardX+o<8) && (boardY+t>=0 && boardY+t<8)) {
						if(isWhite(board[getBoardId(boardX+o,boardY+t)]) || board[getBoardId(boardX+o,boardY+t)]==0) {
							moves.push(getBoardId(boardX+o,boardY+t));
						}
					}
				}
			}
			break;
		case 0x8: //white knight
			for(let t=-2; t<=2; t+=4) { //this replaces the number 2 and -2, fight me
				for(let o=-1; o<=1; o+=2) { //this replaces the number 1 and -1, also fight me
					if((boardX+t>=0 && boardX+t<8) && (boardY+o>=0 && boardY+o<8)) {
						if(isBlack(board[getBoardId(boardX+t,boardY+o)]) || board[getBoardId(boardX+t,boardY+o)]==0) {
							moves.push(getBoardId(boardX+t,boardY+o));
						}
					}
					if((boardX+o>=0 && boardX+o<8) && (boardY+t>=0 && boardY+t<8)) {
						if(isBlack(board[getBoardId(boardX+o,boardY+t)]) || board[getBoardId(boardX+o,boardY+t)]==0) {
							moves.push(getBoardId(boardX+o,boardY+t));
						}
					}
				}
			}
			break;
		case 0xD: //black bishop
			for(let dy=-1; dy<=1; dy+=2) {
				for(let dx=-1; dx<=1; dx+=2) {
					let x = boardX + dx;
					let y = boardY + dy;
					let cont = true;
					while(cont) {
						let newBoardId = getBoardId(x,y);
						if((x>=0 && x<8) && (y>=0 && y<8)) {
							if(isWhite(board[newBoardId]) || board[newBoardId]==0) {
								moves.push(newBoardId);
								cont = board[newBoardId]==0;
							} else {
								cont = false;
							}
							x += dx;
							y += dy;
						} else {
							cont = false;
						}
					}
				}
			}
			break;
		case 0x7: //white bishop
			for(let dy=-1; dy<=1; dy+=2) {
				for(let dx=-1; dx<=1; dx+=2) {
					let x = boardX + dx;
					let y = boardY + dy;
					let cont = true;
					while(cont) {
						let newBoardId = getBoardId(x,y);
						if((x>=0 && x<8) && (y>=0 && y<8)) {
							if(isBlack(board[newBoardId]) || board[newBoardId]==0) {
								moves.push(newBoardId);
								cont = board[newBoardId]==0;
							} else {
								cont = false;
							}
							x += dx;
							y += dy;
						} else {
							cont = false;
						}
					}
				}
			}
			break;
		case 0xC: //black rook
			for(let vh=0; vh<=1; vh++) { //vertical or horizontal selector
				for(let dir=-1; dir<=1; dir+=2) { //direction (up/down and left/right) selector
					let x = vh?boardX:(boardX+dir);
					let y = vh?(boardY+dir):boardY;
					let cont = true;
					while(cont) {
						let newBoardId = getBoardId(x,y);
						if((x>=0 && x<8) && (y>=0 && y<8)) {
							if(isWhite(board[newBoardId]) || board[newBoardId]==0) {
								moves.push(newBoardId);
								cont = board[newBoardId]==0;
							} else {
								cont = false;
							}
						} else {
							cont = false;
						}
						x += vh?0:dir;
						y += vh?dir:0;
					}
				}
			}
			break;
		case 0x6: //white rook
			for(let vh=0; vh<=1; vh++) { //vertical or horizontal selector
				for(let dir=-1; dir<=1; dir+=2) { //direction (up/down and left/right) selector
					let x = vh?boardX:(boardX+dir);
					let y = vh?(boardY+dir):boardY;
					let cont = true;
					while(cont) {
						let newBoardId = getBoardId(x,y);
						if((x>=0 && x<8) && (y>=0 && y<8)) {
							if(isBlack(board[newBoardId]) || board[newBoardId]==0) {
								moves.push(newBoardId);
								cont = board[newBoardId]==0;
							} else {
								cont = false;
							}
						} else {
							cont = false;
						}
						x += vh?0:dir;
						y += vh?dir:0;
					}
				}
			}
			break;
		case 0xB: //black queen
			for(let dir=0; dir<4; dir++) {
				for(let sign=-1; sign<=1; sign+=2) {
					let direction = [[0,sign],[sign,sign],[sign,0],[sign,-sign]];
					let dx,dy;
					[dx,dy] = direction[dir];
					let x = boardX + dx;
					let y = boardY + dy;
					let cont = true;
					while(cont) {
						let newBoardId = getBoardId(x,y);
						if((x>=0 && x<8) && (y>=0 && y<8)) {
							if(isWhite(board[newBoardId]) || board[newBoardId]==0) {
								moves.push(newBoardId);
								cont = board[newBoardId]==0;
							} else {
								cont = false;
							}
						} else {
							cont = false;
						}
						x += dx;
						y += dy;
					}
				}
			}
			break;
		case 0x5: //white queen
			for(let dir=0; dir<4; dir++) {
				for(let sign=-1; sign<=1; sign+=2) {
					let direction = [[0,sign],[sign,sign],[sign,0],[sign,-sign]];
					let dx,dy;
					[dx,dy] = direction[dir];
					let x = boardX + dx;
					let y = boardY + dy;
					let cont = true;
					while(cont) {
						let newBoardId = getBoardId(x,y);
						if((x>=0 && x<8) && (y>=0 && y<8)) {
							if(isBlack(board[newBoardId]) || board[newBoardId]==0) {
								moves.push(newBoardId);
								cont = board[newBoardId]==0;
							} else {
								cont = false;
							}
						} else {
							cont = false;
						}
						x += dx;
						y += dy;
					}
				}
			}
			break;
		case 0xA: //black king
			for(let dir=0; dir<4; dir++) {
				for(let sign=-1; sign<=1; sign+=2) {
					let direction = [[0,sign],[sign,sign],[sign,0],[sign,-sign]];
					let dx,dy;
					[dx,dy] = direction[dir];
					let x = boardX + dx;
					let y = boardY + dy;

					let newBoardId = getBoardId(x,y);
					if((x>=0 && x<8) && (y>=0 && y<8)) {
						if(isWhite(board[newBoardId]) || board[newBoardId]==0) {
							moves.push(newBoardId);
						}
					}
				}
			}
			if(board[5]==0x0 && board[6]==0x0 && board[7]==0xC) { //condition for castling on right
				if(!this.turnLog.some( (move) => (move.boardIds[0]==7 && move.oldPieces[0]==0xC) || move.oldPieces[0]==0xA)) { //rook and king hasn't moved already
					moves.push(6);
				}
			}
			if(board[0]==0xC && board[1]==0x0 && board[2]==0x0 && board[3]==0x0) {
				if(!this.turnLog.some( (move) => (move.boardIds[0]==0 && move.oldPieces[0]==0xC) || move.oldPieces[0]==0xA)) { //rook and king hasn't moved already
					moves.push(2);
				}
			}
			break;
		case 0x4: //white king
			for(let dir=0; dir<4; dir++) {
				for(let sign=-1; sign<=1; sign+=2) {
					let direction = [[0,sign],[sign,sign],[sign,0],[sign,-sign]];
					let dx,dy;
					[dx,dy] = direction[dir];
					let x = boardX + dx;
					let y = boardY + dy;

					let newBoardId = getBoardId(x,y);
					if((x>=0 && x<8) && (y>=0 && y<8)) {
						if(isBlack(board[newBoardId]) || board[newBoardId]==0) {
							moves.push(newBoardId);
						}
					}
				}
			}
			if(board[61]==0x0 && board[62]==0x0 && board[63]==0x6) { //condition for castling on right
				if(!this.turnLog.some( (move) => (move.boardIds[0]==63 && move.oldPieces[0]==0x6) || move.oldPieces[0]==0x4)) { //rook and king hasn't moved already
					moves.push(62);
				}
			}
			if(board[56]==0x6 && board[57]==0x0 && board[58]==0x0 && board[59]==0x0) {
				if(!this.turnLog.some( (move) => (move.boardIds[0]==56 && move.oldPieces[0]==0x6) || move.oldPieces[0]==0x4)) { //rook and king hasn't moved already
					moves.push(58);
				}
			}
			break;
		default:
			break;
		}
		return moves;
	}

	clearMoves() {
		this.legalMoves.moves = [];
	}
	
	/* Meat and potatoes for chess: moving pieces!
	This will attempt to move the piece on the fromId to the toId on the board.
	Usage: [newBoardState, status] = move(fromId, toId)
	It will return the following status depending on the move request:
	-6: fromId or toId out of bounds
	-5: Failed to move piece since the fromId was not the player's piece
	-4: fromId does not match list of boardId for list legal moves generated from last click
	-3: No legal moves available for boardId from the last click
	-2: fromId does not match boardId from last click
	-1: toId is not a legal move
	 0: Valid move, white's turn
	 1: Valid move, black's turn
	 2: White en passant
	 3: Black en passant
	*/
	move(fromId, toId) {
		if(fromId<0 || toId<0 || fromId>63 || toId > 63) return [this.board, -6];
		if(getColor(this.board[fromId]) != this.turnInfo.player) return [this.board, -5];
		if(fromId != this.legalMoves.boardId) return [this.board, -4];
		if(this.legalMoves.moves.length < 1) return [this.board, -3];
		if(this.legalMoves.boardId != fromId) return [this.board, -2]; 
		if(!this.legalMoves.moves.includes(toId)) return [this.board, -1];
		
		this.board[toId] = this.board[fromId];
		this.board[fromId] = 0;
		this.turnInfo.player = (!this.turnInfo.player)?1:0;
		return [this.board, this.turnInfo.player];
	}

}
