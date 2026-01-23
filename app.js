// cPanel/Passenger startup shim for HostGator
// This starts the compiled Express server from dist/index.js

try {
  require('./dist/index.js');
} catch (err) {
  console.error('Failed to start app from dist/index.js. Did you run `npm run build`?', err);
  process.exit(1);
}
