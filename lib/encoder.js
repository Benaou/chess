module.exports = function (data) { //Encode WebSocket packets
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
