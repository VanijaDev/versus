const webpack = require('webpack');
const path = require('path');

const config = {
  name: "index",
  entry: './src/index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'public')
  }
};

module.exports = config;