import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactPlayer from 'react-player';

console.log(renderToString(<ReactPlayer url="https://youtube.com/watch?v=1" />));
