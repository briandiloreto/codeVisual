const fs = require('fs');

if (!fs.existsSync('contentVisual/dist/')){
  fs.mkdirSync('contentVisual/dist/');
}

fs.copyFile('node_modules/@hpcc-js/wasm/dist/graphvizlib.wasm', 'contentVisual/dist/graphvizlib.wasm', (err) => {
  if (err) throw err;
  console.log('graphvizlib.wasm was copied to contentVisual/dist');
});

fs.copyFile('node_modules/@hpcc-js/wasm/dist/index.min.js', 'contentVisual/dist/hpccjswasm.js', (err) => {
  if (err) throw err;
  console.log('hpccjswasm.js was copied to contentVisual/dist');
});

fs.copyFile('node_modules/jquery/dist/jquery.min.js', 'contentVisual/dist/jquery.min.js', (err) => {
  if (err) throw err;
  console.log('jquery.min.js was copied to contentVisual/dist');
});

fs.copyFile('node_modules/jquery-mousewheel/jquery.mousewheel.js', 'contentVisual/dist/jquery.mousewheel.js', (err) => {
  if (err) throw err;
  console.log('jquery.mousewheel.js was copied to contentVisual/dist');
});

fs.copyFile('node_modules/jquery-color/dist/jquery.color.min.js', 'contentVisual/dist/jquery.color.min.js', (err) => {
  if (err) throw err;
  console.log('jquery.color.min.js was copied to contentVisual/dist');
});

fs.copyFile('node_modules/d3/dist/d3.min.js', 'contentVisual/dist/d3.min.js', (err) => {
  if (err) throw err;
  console.log('d3.min.js was copied to contentVisual/dist');
});

fs.copyFile('node_modules/d3-graphviz/build/d3-graphviz.min.js', 'contentVisual/dist/d3-graphviz.min.js', (err) => {
  if (err) throw err;
  console.log('d3-graphviz.min.js was copied to contentVisual/dist');
});

fs.copyFile('node_modules/@vscode/webview-ui-toolkit/dist/toolkit.min.js', 'contentVisual/dist/webviewuitoolkit.min.js', (err) => {
  if (err) throw err;
  console.log('webviewuitoolkit.min.js was copied to contentVisual/dist');
});

fs.copyFile('node_modules/@vscode/codicons/dist/codicon.css', 'contentVisual/dist/codicon.css', (err) => {
  if (err) throw err;
  console.log('codicon.css was copied to contentVisual/dist');
});
fs.copyFile('node_modules/@vscode/codicons/dist/codicon.ttf', 'contentVisual/dist/codicon.ttf', (err) => {
  if (err) throw err;
  console.log('codicon.ttf was copied to contentVisual/dist');
});