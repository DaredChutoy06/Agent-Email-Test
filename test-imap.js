const Imap = require('imap');

const imap = new Imap({
  user: 'alex.doudkin@icloud.com',
  password: 'jzum-btng-jfvn-slzc',
  host: 'imap.mail.me.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
});

imap.on('ready', function() {
  console.log('✓ IMAP READY - CONNECTION AUTHENTICATED');
  imap.openBox('INBOX', false, function(err, box) {
    if (err) {
      console.log('✗ Failed to open INBOX:', err.message);
    } else {
      console.log('✓ INBOX OPENED - Credentials work!');
    }
    imap.end();
  });
});

imap.on('error', function(err) {
  console.log('✗ IMAP ERROR:', err.message);
});

imap.on('end', function() {
  console.log('✓ Connection closed');
});

console.log('Connecting...');
imap.openBox('INBOX', false, function(err) {
  // This callback won't fire until ready
  if (err) console.log('Error:', err.message);
});
