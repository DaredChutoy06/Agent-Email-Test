# Troubleshooting Guide

## Common Issues & Solutions

### 1. Authentication Errors

#### Error: "Invalid credentials"
**Symptoms**: 
```
Error: Invalid credentials
connect ECONNREFUSED imap.mail.me.com:993
```

**Solutions**:
- ✅ Verify using app-specific password, NOT your main iCloud password
- ✅ Confirm IMAP is enabled in iCloud settings:
  - Go to [iCloud Settings](https://www.icloud.com)
  - Account → Sign in
  - Security → Generate app-specific password
  - Select "Mail" and "macOS"
- ✅ Ensure password is exactly 16 characters (with hyphens)
- ✅ Check email address is correct in `.env`

#### Error: "Authentication failed"
**Solution**: App-specific password is not enabled for this app
```bash
# Regenerate:
1. Visit appleid.apple.com
2. Security → Delete old password
3. Generate new app-specific password
4. Update .env file
5. Restart application
```

---

### 2. Connection Issues

#### Error: "connect ECONNREFUSED"
**Symptoms**: Cannot connect to iCloud IMAP server

**Solutions**:
- ✅ Check internet connection: `ping 8.8.8.8`
- ✅ Try in Terminal: `curl -I https://www.icloud.com`
- ✅ Check firewall isn't blocking port 993
- ✅ Try from different network (if available)
- ✅ Verify iCloud service status

#### Error: "Timeout connecting to IMAP"
**Solution**: IMAP server is slow
```env
# Add connection timeout to .env:
IMAP_TIMEOUT=30000  # 30 seconds
```

#### Error: "openBox timeout"
**Symptom**: Takes too long to open INBOX

**Solution**:
- Reduce email scope in `emailScanner.ts`:
```typescript
const idsToFetch = results.slice(Math.max(0, results.length - 50)); // Changed from 100
```

---

### 3. Email Scanning Issues

#### Error: "No emails found"
**Symptoms**: Scan completes but returns 0 emails

**Possible Causes**:
- ✅ INBOX is empty (expected if first time)
- ✅ IMAP access needs permission
- ✅ Wrong folder being scanned

**Solutions**:
1. Check INBOX is accessible in Apple Mail:
   ```
   Open Apple Mail → Check if INBOX has emails
   ```

2. Manually test IMAP connection:
   ```bash
   openssl s_client -connect imap.mail.me.com:993
   ```

3. Enable debug logging:
   ```env
   LOG_LEVEL=debug
   ```

#### Error: "Parse error" on emails
**Symptoms**:
```
Parse error: No sender found
```

**Solutions**:
- Email might have malformed headers
- Check in `emailScanner.ts`, `parseSender()` method
- Add fallback handling:
```typescript
const sender = parsed.from?.text || 'Unknown Sender';
```

#### Error: "Cannot read property 'text' of undefined"
**Solution**: Some emails have missing headers
```typescript
// Change this:
const from = parsed.from.text

// To this:
const from = parsed.from?.text || 'Unknown'
```

---

### 4. API & Analysis Errors

#### Error: "401 Unauthorized" from Anthropic
**Symptoms**:
```
Error: 401 Unauthorized
Invalid API key provided
```

**Solutions**:
- ✅ Check `ANTHROPIC_API_KEY` in `.env`
- ✅ Verify API key hasn't been revoked
- ✅ Go to [console.anthropic.com](https://console.anthropic.com)
- ✅ Create new API key if needed
- ✅ Check API key has billing enabled

#### Error: "429 Rate Limited"
**Symptoms**:
```
Error: 429 Too Many Requests
Rate limit exceeded
```

**Solutions**:
- Wait a few minutes before retrying
- Increase interval in `.env`:
```env
SCAN_INTERVAL_MINUTES=120  # Scan less frequently
```

#### Error: "500 Server Error"
**Solutions**:
- Try again in a few minutes
- Check Anthropic status page
- Try with smaller email batch
- Enable debug logging to see request details

#### Error: "Invalid JSON response"
**Symptom**: Claude's response couldn't be parsed

**Solution**: 
- The system falls back to heuristic analysis
- Check console for `[WARN] No JSON found in response`
- This is normal if Claude changes format

---

### 5. Storage & File Issues

#### Error: "ENOENT: no such file or directory"
**Symptoms**:
```
Error: ENOENT: no such file or directory, open './data/emails.json'
```

**Solution**:
- Data folder not created automatically
- Create manually:
```bash
mkdir -p data
mkdir -p reports
```

#### Error: "Permission denied"
**Solutions**:
- Check file permissions:
```bash
chmod 755 data/
chmod 755 reports/
ls -la data/
```

- Or let application create folders:
```typescript
// Already handled in saveEmails()
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
```

#### Error: "emails.json is corrupted"
**Solution**:
- Delete and rescan:
```bash
rm data/emails.json
npm run dev
```

---

### 6. Node/Dependencies Issues

#### Error: "Cannot find module 'imap'"
**Solution**:
```bash
# Reinstall dependencies:
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### Error: "TypeScript compilation error"
**Solution**:
```bash
# Clear build and rebuild:
rm -rf dist
npm run build

# Or compile with verbose:
npx tsc --listFiles
```

#### Error: "command not found: ts-node"
**Solution**:
```bash
# Install locally:
npm install -g ts-node

# Or run via npm:
npm run dev
```

#### Error: "Node version incompatible"
**Solutions**:
- Check Node version: `node --version`
- Should be 16 or higher:
```bash
# Update Node:
brew install node@18  # macOS
# Or download from nodejs.org
```

---

### 7. Configuration Issues

#### Error: "ICLOUD_EMAIL environment variable is required"
**Solution**:
```bash
# Copy template:
cp .env.example .env

# Edit the file:
nano .env

# Set required variables:
ICLOUD_EMAIL=your@icloud.com
ICLOUD_PASSWORD=xxxx-xxxx-xxxx-xxxx
ANTHROPIC_API_KEY=sk-ant-abc123...
```

#### Error: "Config validation failed"
**Solutions**:
- Check `.env` for required keys
- Verify no extra spaces or quotes:
```env
# ✓ Correct:
ICLOUD_EMAIL=user@icloud.com

# ✗ Wrong:
ICLOUD_EMAIL = user@icloud.com  # Extra spaces
ICLOUD_EMAIL="user@icloud.com"  # Quotes
```

---

### 8. Performance Issues

#### Issue: "Scanning takes too long"
**Solutions**:
- Reduce email scan limit in `emailScanner.ts`:
```typescript
// Change from:
const idsToFetch = results.slice(Math.max(0, results.length - 100));

// To:
const idsToFetch = results.slice(Math.max(0, results.length - 50));
```

- Skip redundant scans by checking last scan time
- Cache results between runs

#### Issue: "High memory usage"
**Solutions**:
- Process emails in smaller batches
- Implement stream processing
- Clear old data regularly:
```bash
rm data/emails.json  # Restart fresh
```

---

### 9. macOS Specific Issues

#### Error: "TLS handshake failed"
**Solutions**:
- Update macOS certificates:
```bash
/Applications/Python\ 3.*/Install\ Certificates.command
```

- Or update Node:
```bash
brew upgrade node
```

#### Error: "Permission denied" on script
**Solution**:
```bash
chmod +x verify-setup.js
./verify-setup.js
```

#### Issue: "AppleScript integration needed"
**Note**: Current version uses IMAP, not Apple Mail API
- This is more reliable and doesn't require extra permissions
- Consider GUI-based version in future

---

### 10. Debug & Diagnostics

#### Enable Debug Logging
```env
LOG_LEVEL=debug
```

Then check output for detailed information:
```
[DEBUG] Connecting with config: {...}
[DEBUG] IMAP response: [....]
[DEBUG] Email parsed: Subject=...
```

#### Run Verification Script
```bash
node verify-setup.js
```

This checks:
- All required files exist
- Environment variables are set
- Configuration is valid

#### Manual IMAP Test
```bash
# Connect with openssl:
openssl s_client -connect imap.mail.me.com:993

# Then type (inside connection):
1 LOGIN your@icloud.com your-app-specific-password
2 LIST "" "*"
3 SELECT INBOX
4 SEARCH ALL
5 LOGOUT
```

#### Test Anthropic API
```bash
# Create test.js:
cat > test-api.js << 'EOF'
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({apiKey: process.env.ANTHROPIC_API_KEY});

client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 100,
  messages: [{role: 'user', content: 'Hello'}]
}).then(r => console.log('API works!', r.content[0].text))
  .catch(e => console.error('API error:', e.message));
EOF

# Run:
ANTHROPIC_API_KEY=sk-ant-xxx node test-api.js
```

---

## Getting Help

### Resources
1. **README.md** - Full documentation
2. **QUICKSTART.md** - Quick setup steps
3. **ARCHITECTURE.md** - System design details
4. **verify-setup.js** - Configuration checker

### Debugging Steps
1. Run verification script
2. Check console logs (enable debug mode)
3. Verify credentials separately
4. Test IMAP connection manually
5. Check API key validity
6. Review analysis report in `/reports`

### Still Stuck?
1. Check error message carefully
2. Search this guide for similar error
3. Review file permissions
4. Verify internet connection
5. Check console output with `LOG_LEVEL=debug`

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0
