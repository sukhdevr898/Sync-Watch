import React, { useRef } from 'react';
import { renderToString } from 'react-dom/server';
import ReactPlayer from 'react-player';

function Test() {
  const ref = useRef(null);
  if (ref.current) {
    console.log("Keys:", Object.keys(ref.current));
  }
  return React.createElement(ReactPlayer, { ref, url: "https://youtube.com/watch?v=1" });
}
console.log(renderToString(React.createElement(Test)));
