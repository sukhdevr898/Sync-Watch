const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ReactPlayer = require('react-player');

console.log(Object.keys(ReactPlayer.default.prototype || {}));
