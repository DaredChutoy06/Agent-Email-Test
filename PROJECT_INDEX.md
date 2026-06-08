# Project Index & Overview

## 📧 iCloud Email Scanner with AI Sub-Agent

An intelligent email management system that:
- ✅ Connects to your iCloud account via IMAP
- ✅ Scans and analyzes your emails
- ✅ Uses Claude AI to identify spam and repetitive emails  
- ✅ Recommends which senders to delete or unsubscribe from
- ✅ Provides confidence scores for each recommendation

---

## 📁 Project Structure

```
Agent-Email-Test/
│
├── 📋 Documentation
│   ├── README.md                 # Full documentation & features
│   ├── QUICKSTART.md             # 5-minute setup guide
│   ├── ARCHITECTURE.md           # System design & components
│   ├── CONFIGURATION.md          # Config examples & reference
│   ├── TROUBLESHOOTING.md        # Error solutions & debugging
│   └── PROJECT_INDEX.md          # This file
│
├── 💻 Source Code
│   ├── src/index.ts              # Main orchestrator
│   ├── src/emailScanner.ts       # iCloud IMAP connection
│   ├── src/subAgent.ts           # AI analysis engine (Claude)
│   ├── src/types.ts              # TypeScript interfaces
│   └── src/utils.ts              # Config & logging
│
├── ⚙️ Configuration
│   ├── package.json              # Dependencies & scripts
│   ├── tsconfig.json             # TypeScript compiler config
│   ├── .env.example              # Environment template
│   └── .gitignore                # Git exclusions
│
├── 🔧 Tools & Scripts
│   └── verify-setup.js           # Configuration validator
│
└── 📦 Generated (on first run)
    ├── dist/                     # Compiled JavaScript
    ├── data/emails.json          # Stored emails
    └── reports/analysis_*.json   # Analysis reports
```

---

## 📚 Documentation Guide

### For Quick Start
**→ Read: [QUICKSTART.md](QUICKSTART.md)**
- 5-minute setup
- Get credentials
- First run

### For Full Understanding  
**→ Read: [README.md](README.md)**
- Features & architecture
- Installation & usage
- Configuration options
- Safety considerations

### For Advanced Configuration
**→ Read: [CONFIGURATION.md](CONFIGURATION.md)**
- Environment variables
- Config examples
- Scheduling setup
- Custom rules

### For System Design
**→ Read: [ARCHITECTURE.md](ARCHITECTURE.md)**
- Component details
- Data flow diagrams
- Performance info
- Extension points

### For Problem Solving
**→ Read: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)**
- Common errors
- Diagnostic steps
- Solution procedures
- Debug logging

---

## 🚀 Quick Start (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Setup credentials (.env file)
cp .env.example .env
# Edit .env with your credentials

# 3. Build TypeScript
npm run build

# 4. Run scanner
npm start
```

---

## 📊 System Architecture

```
iCloud Mail
    ↓
EmailScanner (IMAP)
    ↓
Email Storage (JSON)
    ↓
Sub-Agent Analyzer
    ↓
Claude AI (Anthropic)
    ↓
Report & Recommendations
```

---

## 🔑 Key Components

### EmailScanner (`src/emailScanner.ts`)
- Connects to iCloud via IMAP
- Fetches recent emails
- Parses sender info
- Stores emails locally

### EmailAnalysisAgent (`src/subAgent.ts`)
- Groups emails by sender
- Calculates statistics
- Sends data to Claude AI
- Parses recommendations

### Utils (`src/utils.ts`)
- Configuration management
- Environment validation
- Structured logging

### Types (`src/types.ts`)
- TypeScript interfaces
- Data structures
- Type safety

---

## 🎯 What It Does

1. **Scans**: Connects to iCloud and fetches your recent emails
2. **Analyzes**: Groups emails by sender and calculates patterns:
   - Read rate
   - Email frequency
   - Unread count
3. **AI Analysis**: Sends aggregated data to Claude AI
4. **Recommends**: Gets intelligent recommendations for:
   - **Delete**: Obvious spam (5% read rate, frequent)
   - **Unsubscribe**: Newsletters you ignore
   - **Review**: Borderline cases
   - **Keep**: Important senders
5. **Reports**: Generates detailed JSON report with confidence scores

---

## 🔐 Security

- ✅ Uses app-specific password (not main account)
- ✅ Local data processing
- ✅ No email bodies sent to API
- ✅ Encrypted IMAP connection
- ✅ No tracking/telemetry

---

## 📦 Dependencies

### Runtime
- `@anthropic-ai/sdk` - Claude AI integration
- `imap-simple` - IMAP client
- `mailparser` - Email parsing
- `dotenv` - Environment config

### Development
- `typescript` - Type checking
- `ts-node` - Run TypeScript directly

---

## 🛠️ Available Commands

```bash
# Development
npm run dev              # Run with ts-node (no compile)

# Building
npm run build            # Compile TypeScript → JavaScript

# Production
npm start                # Run compiled version

# Utilities
npm run scan             # Just scan emails
npm run analyze          # Just analyze (with existing data)
npm test                 # Run tests (when added)
```

---

## 📋 Configuration Reference

### Required Credentials
```env
ICLOUD_EMAIL=your@icloud.com
ICLOUD_PASSWORD=abcd-efgh-ijkl-mnop
ANTHROPIC_API_KEY=sk-ant-...
```

### Optional Settings
```env
SCAN_INTERVAL_MINUTES=60
ENABLE_AUTO_DELETE=false
DELETE_CONFIDENCE_THRESHOLD=0.9
LOG_LEVEL=info
```

See [CONFIGURATION.md](CONFIGURATION.md) for full reference.

---

## 🔍 Understanding Output

### Console Output
```
[INFO] Starting iCloud Email Scanner with Sub-Agent Analysis
[INFO] Connected to iCloud successfully
[INFO] Found 95 recent emails
[INFO] Analyzing email patterns with AI...
[INFO] Analysis complete

EMAIL ANALYSIS RESULTS
- Recommended for deletion: 3 senders
- Recommended for unsubscription: 7 senders  
- Recommended for review: 12 senders
```

### Analysis Report (`reports/analysis_*.json`)
```json
{
  "analyses": [
    {
      "sender": "marketing@example.com",
      "recommendation": "unsubscribe",
      "confidence": 0.85,
      "totalEmails": 42,
      "unreadCount": 38,
      "readRate": 9.5
    }
  ],
  "recommendedActions": {
    "delete": ["spam@example.com"],
    "unsubscribe": ["marketing@example.com"],
    "review": ["newsletter@example.com"]
  }
}
```

---

## 🎓 Learning Path

1. **Understand the basics**
   - Read README.md overview
   - Understand the architecture

2. **Get started**
   - Follow QUICKSTART.md
   - Set up credentials
   - Run first scan

3. **Learn details**
   - Review ARCHITECTURE.md
   - Look at source code
   - Check example configs

4. **Advanced usage**
   - Customize analysis
   - Set up scheduling
   - Create rules

5. **Troubleshoot**
   - Reference TROUBLESHOOTING.md
   - Enable debug logging
   - Check error codes

---

## 🔗 External Links

- **Apple ID Settings**: https://appleid.apple.com
- **Generate App Password**: https://support.apple.com/en-us/102654
- **Anthropic Console**: https://console.anthropic.com
- **Claude Documentation**: https://docs.anthropic.com
- **Node.js**: https://nodejs.org

---

## 📈 Project Status

- ✅ Email scanning (iCloud IMAP)
- ✅ Pattern analysis
- ✅ AI integration (Claude)
- ✅ Recommendation engine
- ✅ Report generation
- ⏳ Auto-deletion (framework ready)
- ⏳ Auto-unsubscription (framework ready)
- ⏳ Web UI (planned)
- ⏳ ML training (planned)

---

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Web dashboard
- Email deletion automation
- Unsubscribe link detection
- ML-based classification
- Multi-account support
- Additional email providers

---

## 📞 Support

1. Check appropriate documentation (README, QUICKSTART, etc.)
2. Run verification script: `node verify-setup.js`
3. Enable debug logging: `LOG_LEVEL=debug`
4. Review TROUBLESHOOTING.md
5. Check generated reports

---

## 📜 License

MIT License - See LICENSE file

---

## 🚦 Next Steps

### Immediate
1. Read [QUICKSTART.md](QUICKSTART.md)
2. Install dependencies: `npm install`
3. Configure credentials: `cp .env.example .env && nano .env`
4. Run: `npm run dev`

### Short Term
1. Review recommendations in reports
2. Manually clean up senders
3. Adjust confidence thresholds

### Medium Term
1. Set up scheduled scanning
2. Automate actions (when ready)
3. Fine-tune analysis rules

### Long Term
1. Build web dashboard
2. Add machine learning
3. Support multiple accounts

---

**Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**Status**: Production Ready
