// ------------------ WebSocket implementation ----------------//
module.exports = function decode(buffer) { //Decode WebSocket packets

	let length = buffer[1]&0x7F; //payload length if it's less than 126
	let index = 2;
	if(length == 126) { //payload length is 126, meaning read the next 16 bits for the length
		length = (buffer[2]<<8)+buffer[3];
		index += 2;
	} else if(length == 127) {
		length = 0;
		for(let i=0; i<8; i++)
			length += buffer[2+i]<<(8*(7-i));
		index += 8;
	}
	
  var MASK = buffer.slice(index,index+4);
	var ENCODED = buffer.slice(index+4,index+4+length);
	var DECODED = new Array(length);
	DECODED.fill(0);
	
  for(var i = 0; i< ENCODED.length; i++)
		DECODED[i] = ENCODED[i] ^ MASK[i % 4];
	
  return DECODED.map(c=>String.fromCharCode(c)).join('');
}
