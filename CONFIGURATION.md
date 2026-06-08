# Configuration Examples

## Standard Setup

```env
# .env

# iCloud Credentials (required)
ICLOUD_EMAIL=yourname@icloud.com
ICLOUD_PASSWORD=abcd-efgh-ijkl-mnop

# Anthropic API Key (required)
ANTHROPIC_API_KEY=sk-ant-v0-abc123def456...

# Scanning Configuration
SCAN_INTERVAL_MINUTES=60
EMAIL_STORAGE_PATH=./data/emails.json
ANALYSIS_THRESHOLD=3

# Sub-Agent Configuration
ENABLE_AUTO_DELETE=false
ENABLE_AUTO_UNSUBSCRIBE=false
DELETE_CONFIDENCE_THRESHOLD=0.9
UNSUBSCRIBE_CONFIDENCE_THRESHOLD=0.85

# Logging
LOG_LEVEL=info
```

---

## Conservative Setup (No Auto-Actions)

Use this to review recommendations before taking any action:

```env
# .env - Conservative Mode

ICLOUD_EMAIL=yourname@icloud.com
ICLOUD_PASSWORD=abcd-efgh-ijkl-mnop
ANTHROPIC_API_KEY=sk-ant-v0-abc123def456...

# Scan less frequently for review
SCAN_INTERVAL_MINUTES=1440

# Very high confidence thresholds - only certain deletions
ENABLE_AUTO_DELETE=false
DELETE_CONFIDENCE_THRESHOLD=0.95

ENABLE_AUTO_UNSUBSCRIBE=false
UNSUBSCRIBE_CONFIDENCE_THRESHOLD=0.95

# Verbose logging to understand decisions
LOG_LEVEL=debug
```

**Use case**: First-time users, important accounts, needs manual review

---

## Aggressive Setup (Auto Cleanup)

Once you're comfortable with the system:

```env
# .env - Aggressive Mode

ICLOUD_EMAIL=yourname@icloud.com
ICLOUD_PASSWORD=abcd-efgh-ijkl-mnop
ANTHROPIC_API_KEY=sk-ant-v0-abc123def456...

# Scan frequently for quick cleanup
SCAN_INTERVAL_MINUTES=15

# Lower thresholds - auto-cleanup enabled
ENABLE_AUTO_DELETE=true
DELETE_CONFIDENCE_THRESHOLD=0.85

ENABLE_AUTO_UNSUBSCRIBE=true
UNSUBSCRIBE_CONFIDENCE_THRESHOLD=0.80

# Normal logging
LOG_LEVEL=info
```

**Use case**: High email volume, want automatic cleanup

---

## Custom Thresholds

### Low Spam Tolerance (Very Conservative)
```env
DELETE_CONFIDENCE_THRESHOLD=0.98
UNSUBSCRIBE_CONFIDENCE_THRESHOLD=0.95
```
Only acts on near-certain recommendations

### High Spam Tolerance (Aggressive Cleanup)
```env
DELETE_CONFIDENCE_THRESHOLD=0.75
UNSUBSCRIBE_CONFIDENCE_THRESHOLD=0.70
```
Removes more emails, may have false positives

### Balanced (Recommended)
```env
DELETE_CONFIDENCE_THRESHOLD=0.90
UNSUBSCRIBE_CONFIDENCE_THRESHOLD=0.85
```
Good balance between safety and cleanup

---

## Development Setup

```env
# .env - Development

ICLOUD_EMAIL=test@icloud.com
ICLOUD_PASSWORD=xxxx-xxxx-xxxx-xxxx
ANTHROPIC_API_KEY=sk-ant-test-key-xxxx

# Quick testing
SCAN_INTERVAL_MINUTES=1
EMAIL_STORAGE_PATH=./data/test-emails.json

# Always manual review
ENABLE_AUTO_DELETE=false
ENABLE_AUTO_UNSUBSCRIBE=false

# Verbose output
LOG_LEVEL=debug

# Test only 20 emails
ANALYSIS_THRESHOLD=20
```

**Use case**: Testing new features, debugging

---

## Production Setup

```env
# .env - Production

ICLOUD_EMAIL=production@icloud.com
ICLOUD_PASSWORD=abcd-efgh-ijkl-mnop
ANTHROPIC_API_KEY=sk-ant-prod-key-xxxxx

# Regular cadence
SCAN_INTERVAL_MINUTES=360

# Automated cleanup with safety margins
ENABLE_AUTO_DELETE=true
DELETE_CONFIDENCE_THRESHOLD=0.92

ENABLE_AUTO_UNSUBSCRIBE=true
UNSUBSCRIBE_CONFIDENCE_THRESHOLD=0.88

# Only warnings and errors
LOG_LEVEL=warn

# Backup storage
EMAIL_STORAGE_PATH=/backups/emails/main-backup.json
```

**Use case**: Unattended recurring scans

---

## Multiple Account Setup

### Account 1
```env
# .env.account1

ICLOUD_EMAIL=account1@icloud.com
ICLOUD_PASSWORD=pwd1-pwd1-pwd1-pwd1
ANTHROPIC_API_KEY=sk-ant-key1...

EMAIL_STORAGE_PATH=./data/account1.json
```

### Account 2
```env
# .env.account2

ICLOUD_EMAIL=account2@icloud.com
ICLOUD_PASSWORD=pwd2-pwd2-pwd2-pwd2
ANTHROPIC_API_KEY=sk-ant-key2...

EMAIL_STORAGE_PATH=./data/account2.json
```

### Run both
```bash
# Terminal 1
NODE_ENV=account1 npm start

# Terminal 2
NODE_ENV=account2 npm start
```

---

## Whitelist/Blacklist Patterns

These aren't env variables - add to `src/index.ts`:

```typescript
// Important senders to never analyze
const WHITELIST = [
  'noreply@github.com',
  'no-reply@apple.com',
  'security-alerts@company.com'
];

// Always mark as delete
const BLACKLIST = [
  'spam@example.com',
  'phishing@fake.com'
];

// Filter in main loop:
const filteredAnalyses = analysis.analyses.filter(a => 
  !WHITELIST.includes(a.sender) && !BLACKLIST.includes(a.sender)
);
```

---

## Custom Confidence Scoring

Modify `src/subAgent.ts`:

```typescript
// Adjust these weights in parseAnalysisResponse():
const readRateWeight = 0.4;     // 40% importance
const frequencyWeight = 0.3;    // 30% importance
const engagementWeight = 0.3;   // 30% importance

const confidence = 
  (readRate < 30 ? 1 : 0) * readRateWeight +
  (frequency < 2 ? 1 : 0) * frequencyWeight +
  (unreadCount > total * 0.5 ? 1 : 0) * engagementWeight;
```

---

## Scheduling Examples

### macOS - Every Hour
```bash
# Create LaunchAgent
cat > ~/Library/LaunchAgents/com.emailscanner.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.emailscanner</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/you/Agent-Email-Test/dist/index.js</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>StandardOutPath</key>
    <string>/tmp/emailscanner.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/emailscanner-error.log</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.emailscanner.plist
```

### macOS - Daily at 2 AM
```bash
cat > ~/Library/LaunchAgents/com.emailscanner.daily.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.emailscanner.daily</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/you/Agent-Email-Test/dist/index.js</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.emailscanner.daily.plist
```

### Linux - Every 30 Minutes with Cron
```bash
# Edit crontab:
crontab -e

# Add line:
*/30 * * * * cd /home/user/Agent-Email-Test && npm start >> /tmp/emailscanner.log 2>&1
```

### Docker Container
```dockerfile
FROM node:18

WORKDIR /app
COPY . .

RUN npm install
RUN npm run build

# Set environment
ENV ICLOUD_EMAIL=your@icloud.com
ENV ICLOUD_PASSWORD=xxxx-xxxx-xxxx-xxxx
ENV ANTHROPIC_API_KEY=sk-ant-xxx

CMD ["node", "dist/index.js"]
```

---

## Environment Variable Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ICLOUD_EMAIL` | string | *required* | Your iCloud email address |
| `ICLOUD_PASSWORD` | string | *required* | App-specific password |
| `ANTHROPIC_API_KEY` | string | *required* | Claude API key |
| `SCAN_INTERVAL_MINUTES` | number | 60 | Minutes between scans |
| `EMAIL_STORAGE_PATH` | string | ./data/emails.json | Where to store emails |
| `ANALYSIS_THRESHOLD` | number | 3 | Min emails per sender to analyze |
| `ENABLE_AUTO_DELETE` | boolean | false | Auto-delete emails |
| `ENABLE_AUTO_UNSUBSCRIBE` | boolean | false | Auto-unsubscribe |
| `DELETE_CONFIDENCE_THRESHOLD` | decimal | 0.9 | Confidence for deletion (0-1) |
| `UNSUBSCRIBE_CONFIDENCE_THRESHOLD` | decimal | 0.85 | Confidence for unsub (0-1) |
| `LOG_LEVEL` | string | info | Logging: debug/info/warn/error |

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0
