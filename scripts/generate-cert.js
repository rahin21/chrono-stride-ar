const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create certificates directory if it doesn't exist
const certsDir = path.join(__dirname, '../certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir);
}

// Generate certificates
try {
  // Generate private key
  execSync(`openssl genrsa -out ${path.join(certsDir, 'key.pem')} 2048`, { stdio: 'inherit' });
  
  // Generate CSR
  execSync(`openssl req -new -key ${path.join(certsDir, 'key.pem')} -out ${path.join(certsDir, 'csr.pem')} -subj "/CN=localhost"`, { stdio: 'inherit' });
  
  // Generate self-signed certificate
  execSync(`openssl x509 -req -days 365 -in ${path.join(certsDir, 'csr.pem')} -signkey ${path.join(certsDir, 'key.pem')} -out ${path.join(certsDir, 'cert.pem')}`, { stdio: 'inherit' });
  
  // Clean up CSR
  fs.unlinkSync(path.join(certsDir, 'csr.pem'));
  
  console.log('SSL certificates generated successfully!');
} catch (error) {
  console.error('Error generating certificates:', error);
  process.exit(1);
} 