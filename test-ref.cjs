const React = require('react');
const ReactPlayer = require('react-player');
const { renderToStaticMarkup } = require('react-dom/server');

const ref = React.createRef();
const el = React.createElement(ReactPlayer.default, { ref, url: "https://youtube.com/watch?v=1" });
renderToStaticMarkup(el);
console.log(ref.current ? Object.keys(ref.current) : "null");
