# iCloud Email Scanner with AI Sub-Agent

An intelligent email scanning system that connects to your iCloud account and uses AI to analyze email patterns, identifying repetitive, unread, and unwanted emails that should be deleted or unsubscribed from.

## Features

- **iCloud Email Integration**: Connects to iCloud/Apple Mail to scan your inbox
- **Pattern Analysis**: Analyzes sender frequency, read rates, and engagement patterns
- **AI-Powered Sub-Agent**: Uses Claude AI to intelligently categorize senders
- **Smart Recommendations**: Automatically suggests which senders to delete, unsubscribe from, or keep
- **Batch Processing**: Scans and stores emails for continuous analysis
- **Confidence Scoring**: Provides confidence levels for each recommendation

## Architecture

```
┌─────────────────┐
│   iCloud Mail   │
└────────┬────────┘
         │
    ┌────▼─────────────────┐
    │  Email Scanner       │ ← Connects via IMAP
    │  (emailScanner.ts)   │
    └────┬─────────────────┘
         │
    ┌────▼─────────────────────┐
    │  Email Storage           │
    │  (JSON file)             │
    └────┬─────────────────────┘
         │
    ┌────▼──────────────────┐
    │  Sub-Agent Analyzer   │
    │  (subAgent.ts)        │
    └────┬──────────────────┘
         │
    ┌────▼────────────────────┐
    │  Claude AI (Anthropic)  │
    │  Analysis Engine        │
    └────┬────────────────────┘
         │
    ┌────▼──────────────────┐
    │  Analysis Report      │
    │  & Recommendations    │
    └──────────────────────┘
```

## Prerequisites

- Node.js 16+ and npm
- iCloud account with [App-Specific Password](https://support.apple.com/en-us/102654) generated
- Anthropic API key (get from [console.anthropic.com](https://console.anthropic.com))
- macOS (if running directly on Mac) or access to iCloud IMAP

## Installation

1. **Clone the repository**
   ```bash
   cd Agent-Email-Test
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Set up environment variables in `.env`:**
   ```env
   ICLOUD_EMAIL=your-icloud-email@icloud.com
   ICLOUD_PASSWORD=your-app-specific-password
   ANTHROPIC_API_KEY=sk-ant-...
   ```

## Configuration

Key settings in `.env`:

- **ICLOUD_EMAIL**: Your iCloud email address
- **ICLOUD_PASSWORD**: App-specific password (NOT your main password)
- **ANTHROPIC_API_KEY**: Your Anthropic API key
- **SCAN_INTERVAL_MINUTES**: How often to scan (default: 60)
- **ENABLE_AUTO_DELETE**: Automatically delete recommended emails
- **ENABLE_AUTO_UNSUBSCRIBE**: Reserved for future fully automated unsubscribe actions
- **DELETE_CONFIDENCE_THRESHOLD**: Confidence level to trigger deletion (default: 0.9)
- **UNSUBSCRIBE_CONFIDENCE_THRESHOLD**: Confidence level to trigger unsubscription (default: 0.85)

## Getting an App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in to your Apple ID
3. Go to "Security"
4. Click "Generate app-specific password" under "App-specific passwords"
5. Select "Mail" and "macOS"
6. Copy the generated password and use it in `.env`

## Usage

### Build the project
```bash
npm run build
```

### Run email scanner and analysis
```bash
npm run dev
```

Or after building:
```bash
npm start
```

### Scan more email history

Normal runs only scan for new mail since the last stored UID. To pull in more historical inbox messages, run a backfill scan:

```bash
npm run dev -- --scan-more 500
```

This scans the most recent 500 inbox messages, merges anything not already in `data/emails.json`, then analyzes the full stored set. `--backfill` is an alias:

```bash
npm run dev -- --backfill 1000
```

### Direct email scanning
```bash
npm run scan
```

### Direct analysis (with existing email data)
```bash
npm run analyze
```

### Unsubscribe foundation

The unsubscribe agent is explicit-selection only and defaults to dry-run mode.

```bash
npm run unsubscribe -- --sender newsletter@example.com
npm run unsubscribe -- --selected selected-unsubscribe.json
```

Selection files can be an array of sender emails:

```json
["newsletter@example.com", "marketing@example.com"]
```

Or an object:

```json
{
  "unsubscribe": ["newsletter@example.com"],
  "messageIds": ["<message-id@example.com>"],
  "emailIds": ["stored-email-id"]
}
```

To actually execute safe one-click `List-Unsubscribe` POST requests:

```bash
npm run unsubscribe -- --selected selected-unsubscribe.json --execute
```

The agent only executes RFC-style one-click unsubscribe links. Mailto links, ordinary unsubscribe pages, body links, and protected senders are reported for manual review.

## Output

The scanner generates:

1. **Console Output**: Real-time logs showing:
   - Connection status
   - Number of emails found
   - Analysis progress
   - Recommendations with confidence scores

2. **Email Storage**: `./data/emails.json`
   - Stores scanned emails for analysis
   - Persists data between runs

3. **Analysis Report**: `./reports/analysis_[timestamp].json`
   - Complete analysis results
   - Recommendations per sender
   - Confidence scores

Example report structure:
```json
{
  "analyses": [
    {
      "sender": "marketing@example.com",
      "recommendation": "unsubscribe",
      "confidence": 0.85,
      "totalEmails": 42,
      "unreadCount": 38,
      "readRate": 9.5,
      "reason": "Based on 9.5% read rate and 0.5 days average frequency"
    }
  ],
  "recommendedActions": {
    "delete": ["spam@example.com"],
    "unsubscribe": ["marketing@example.com"],
    "review": ["newsletter@example.com"]
  },
  "summary": "Email Analysis Summary: 1 senders recommended for deletion, 1 for unsubscription, 1 for review."
}
```

## How It Works

1. **Email Scanning**
   - Connects to iCloud via IMAP
   - Retrieves recent emails from INBOX
   - Extracts sender, subject, date, read status
   - Merges with previously stored emails

2. **Pattern Analysis**
   - Groups emails by sender
   - Calculates read rates
   - Determines email frequency
   - Identifies repetitive patterns

3. **AI Analysis**
   - Sends aggregated data to Claude AI
   - Claude evaluates patterns and makes recommendations
   - Considers: read rates, frequency, content repetition
   - Assigns confidence scores to each recommendation

4. **Report Generation**
   - Displays results in console
   - Saves detailed report to JSON file
   - Categories: delete, unsubscribe, review, keep

## Email Analysis Criteria

The AI considers these factors when analyzing senders:

| Factor | Weight | Decision |
|--------|--------|----------|
| Read Rate < 20% | High | Delete or Unsubscribe |
| Unread Count > 50% of total | High | Likely Spam |
| Frequency < 3 days with low engagement | Medium | Unsubscribe |
| Read Rate > 80% | High | Keep |
| Repetitive subjects | Medium | Spam Indicator |
| Sender reputation | Low | Context only |

## Advanced Usage

### Scheduling Scans (macOS)

Create a LaunchAgent to run scans automatically:

```bash
# Create LaunchAgent plist
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/com.email-scanner.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.email-scanner</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/Agent-Email-Test/dist/index.js</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
</dict>
</plist>
EOF

# Load the agent
launchctl load ~/Library/LaunchAgents/com.email-scanner.plist
```

### Extend Analysis

Modify `src/subAgent.ts` to add custom analysis:

```typescript
// Add custom analysis logic in parseAnalysisResponse()
// Or create specialized sub-agents for different email types
```

## Troubleshooting

### "Failed to open INBOX" Error
- Verify iCloud email is correct
- Check that app-specific password is set (not main password)
- Ensure you have IMAP enabled in iCloud settings

### "Claude API Error"
- Verify `ANTHROPIC_API_KEY` is correct
- Check API key has sufficient credits
- Ensure no network connectivity issues

### No Emails Found
- Check IMAP connection logs
- Verify inbox has emails
- Try increasing `SCAN_INTERVAL_MINUTES`

### High Confidence False Positives
- Adjust `DELETE_CONFIDENCE_THRESHOLD`
- Add sender to whitelist
- Review reason in analysis report

## Safety & Privacy

- **No data sent to external servers** except Claude API
- Email bodies are processed locally (only headers + limited content sent to Claude)
- App-specific passwords are more secure than main passwords
- All analysis reports stored locally
- No tracking or telemetry

## Limitations

- **IMAP only**: Works with iCloud Mail via IMAP protocol
- **No broad auto-actions yet**: Recommendations are report-only by default; the unsubscribe agent requires explicit sender selection and only executes one-click unsubscribe links when run with `--execute`
- **Batch processing**: Scans on demand, not real-time
- **Storage**: Depends on local JSON file for email history

## Future Enhancements

- [ ] Automatic email deletion based on recommendations
- [ ] Automatic unsubscription from mailing lists
- [ ] Web UI for review and manual actions
- [ ] Machine learning model training over time
- [ ] Support for multiple email accounts
- [ ] Email filtering rules generation
- [ ] Integration with Apple Mail rules
- [ ] Realtime notifications

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License

## Support

For issues or questions, check:
1. `.env` configuration is correct
2. Console logs for error details
3. Analysis report for detailed information
4. iCloud account security settings

---

**Note**: This tool is for personal email management. Always review recommendations before taking action on important senders.
