const ReactPlayer = require('react-player');
console.log(Object.keys(ReactPlayer));
console.log(typeof ReactPlayer.default);
if (ReactPlayer.default && ReactPlayer.default.prototype) {
  console.log(Object.keys(ReactPlayer.default.prototype));
}
