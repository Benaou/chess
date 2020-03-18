// Allow commandline parameters to be passed in NodeJS

module.exports = function(alternate_port){  
  var arguments = getCommandLine();
  var arguments = arguments ? arguments : alternate_port;
  return arguments;
}

// In nodejs the process.argv holds the commandline input
// process.argv[0] is 'node'
// process_argv[1] is the file to run if provided
// process_argv[2] can be our port (or anything we desire)

function getCommandLine(arg_array_position = 2){
  return process.argv[arg_array_position] 
}