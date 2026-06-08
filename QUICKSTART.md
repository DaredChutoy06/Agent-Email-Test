# Quick Start Guide

## 1. Initial Setup (5 minutes)

```bash
# Navigate to project
cd Agent-Email-Test

# Install dependencies
npm install
```

## 2. Get Credentials (2 minutes)

### iCloud App-Specific Password
1. Visit [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Security → Generate app-specific password
4. Select "Mail" and "macOS"
5. Copy the 16-character password

### Anthropic API Key
1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to "API Keys"
4. Create new API key
5. Copy the key (starts with `sk-ant-`)

## 3. Configure Environment (2 minutes)

```bash
# Copy template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Example .env:
```env
ICLOUD_EMAIL=john@icloud.com
ICLOUD_PASSWORD=xxxx-xxxx-xxxx-xxxx
ANTHROPIC_API_KEY=sk-ant-abc123...
```

## 4. Build & Run (2 minutes)

```bash
# Build TypeScript
npm run build

# Run the scanner
npm start
```

## Expected Output

```
[INFO] Starting iCloud Email Scanner with Sub-Agent Analysis
[INFO] Connecting to iCloud account... { email: 'your@icloud.com' }
[INFO] Connected to iCloud successfully
[INFO] Scanning emails from INBOX...
[INFO] Found 95 recent emails
[INFO] Loaded 52 previously stored emails
[INFO] Total unique emails: 124
[INFO] Closed iCloud connection
[INFO] Initializing AI analysis agent...
[INFO] Analyzing email patterns with AI...
[INFO] Analysis complete {
  totalEmailsScanned: 124,
  recommendedDelete: 3,
  recommendedUnsubscribe: 7,
  recommendedReview: 12
}

============================================================
EMAIL ANALYSIS RESULTS
============================================================

Total Emails Analyzed: 124
Analysis Timestamp: 2024-01-15T10:30:00.000Z

Email Analysis Summary: 3 senders recommended for deletion, 7 for unsubscription, 12 for review.

--- RECOMMENDED FOR DELETION ---
  • spam@example.com (Confidence: 92.5%)
    Reason: Based on 5.2% read rate and 0.3 days average frequency
  ...

--- RECOMMENDED FOR UNSUBSCRIPTION ---
  • marketing@example.com (Confidence: 88.0%)
    Reason: Based on 12.1% read rate and 1.5 days average frequency
  ...
```

## 5. Interpret Results

- **Delete**: Likely spam, very low engagement
- **Unsubscribe**: Newsletters you don't read regularly
- **Review**: Marginal cases needing human review
- **Keep**: Important senders with high engagement

## 6. Next Steps

### Option A: Manual Review
1. Check `./reports/analysis_[timestamp].json`
2. Review each recommendation
3. Manually delete/unsubscribe in iCloud Mail

### Option B: Automated Actions
Update `.env`:
```env
ENABLE_AUTO_DELETE=true
ENABLE_AUTO_UNSUBSCRIBE=true
DELETE_CONFIDENCE_THRESHOLD=0.95
```

Then run again (feature in development).

## Common Issues

| Issue | Solution |
|-------|----------|
| "Auth failed" | Check app-specific password (not main password) |
| "No emails found" | Verify IMAP is enabled in iCloud settings |
| "API error" | Check Anthropic API key and account balance |
| "Connection timeout" | Check internet connection and firewall |

## Tips

- First run will take longer (initial scan)
- Subsequent runs are faster (incremental)
- Review confidence scores - higher = more certain
- Check reports folder for detailed analysis
- Run periodically (weekly recommended)

## Need Help?

1. Check full README.md for detailed documentation
2. Review console output for error messages
3. Check `.env` configuration
4. Verify credentials are correct
5. Check internet connectivity

---

**Ready?** Run: `npm start`
