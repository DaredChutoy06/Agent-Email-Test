# Project Architecture & Components

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Email Scanner System                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────┐
│   iCloud Mail   │ (User's email account)
│  (IMAP Access)  │
└────────┬────────┘
         │ IMAP Protocol
         │
    ┌────▼──────────────────────────────────┐
    │ EmailScanner (emailScanner.ts)         │
    ├────────────────────────────────────────┤
    │ • Connect to iCloud via IMAP           │
    │ • Fetch emails from INBOX              │
    │ • Parse email headers & content        │
    │ • Extract sender info                  │
    └────┬───────────────────────────────────┘
         │ Email Objects
         │
    ┌────▼──────────────────────────────────┐
    │ Email Storage (data/emails.json)       │
    ├────────────────────────────────────────┤
    │ • Persistent email database            │
    │ • Deduplication                        │
    │ • Historical tracking                  │
    └────┬───────────────────────────────────┘
         │ Aggregated Data
         │
    ┌────▼──────────────────────────────────┐
    │ EmailAnalysisAgent (subAgent.ts)      │
    ├────────────────────────────────────────┤
    │ • Group emails by sender               │
    │ • Calculate statistics                 │
    │ • Prepare analysis prompt              │
    └────┬───────────────────────────────────┘
         │ Analysis Request
         │
    ┌────▼──────────────────────────────────┐
    │ Claude AI (Anthropic API)              │
    ├────────────────────────────────────────┤
    │ • Analyze patterns                     │
    │ • Assess sender reputation             │
    │ • Make recommendations                 │
    │ • Confidence scoring                   │
    └────┬───────────────────────────────────┘
         │ JSON Response
         │
    ┌────▼──────────────────────────────────┐
    │ Output Generation                      │
    ├────────────────────────────────────────┤
    │ • Console display                      │
    │ • JSON report                          │
    │ • Recommendations                      │
    └────────────────────────────────────────┘
```

## File Structure

```
Agent-Email-Test/
├── src/
│   ├── index.ts                 # Main orchestrator
│   ├── emailScanner.ts          # iCloud connection & scanning
│   ├── subAgent.ts              # AI analysis engine
│   ├── types.ts                 # TypeScript interfaces
│   └── utils.ts                 # Config & logging
├── data/
│   └── emails.json              # Persisted email storage
├── reports/
│   └── analysis_*.json          # Analysis reports
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
├── .env.example                 # Environment template
├── .gitignore                   # Git exclusions
├── README.md                    # Full documentation
├── QUICKSTART.md                # Quick setup guide
└── ARCHITECTURE.md              # This file
```

## Component Details

### 1. EmailScanner (emailScanner.ts)
**Purpose**: Bridge between iCloud and the application

**Responsibilities**:
- Establish IMAP connection to iCloud
- Authenticate with app-specific password
- Fetch emails from INBOX
- Parse email metadata
- Store emails locally for analysis

**Key Methods**:
- `connect()`: Establish IMAP connection
- `scanEmails(limit)`: Fetch recent emails
- `loadStoredEmails()`: Read persisted emails
- `saveEmails(emails)`: Store emails locally

**Data Flow**:
```
iCloud IMAP → Parse → Email Objects → JSON Storage
```

### 2. EmailAnalysisAgent (subAgent.ts)
**Purpose**: Intelligent analysis of email patterns

**Responsibilities**:
- Group emails by sender
- Calculate statistical metrics
- Format data for Claude AI
- Parse AI recommendations
- Generate confidence scores

**Key Methods**:
- `analyzeEmails(emails)`: Main analysis pipeline
- `groupEmailsBySender()`: Organize by sender
- `calculateAverageFrequency()`: Determine email frequency
- `buildAnalysisPrompt()`: Create Claude prompt
- `parseAnalysisResponse()`: Extract recommendations

**Analysis Metrics**:
- Read rate (%)
- Unread count
- Email frequency (days)
- Subject line patterns
- Engagement trend

### 3. Utils (utils.ts)
**Purpose**: Configuration and logging infrastructure

**Key Functions**:
- `loadConfig()`: Read environment variables
- `validateConfig()`: Verify credentials
- `Logger`: Structured logging with levels

**Configuration**:
- iCloud credentials
- API keys
- Scan intervals
- Confidence thresholds
- Automation flags

### 4. Types (types.ts)
**Purpose**: Type safety and data contracts

**Main Types**:
- `Email`: Individual email record
- `EmailAnalysis`: Analysis result per sender
- `SubAgentAnalysis`: Complete analysis output
- `EmailStorage`: Persistence format
- `iCloudConfig`: Connection credentials

## Data Flow

### 1. Scanning Flow
```
START
  ↓
Load Config
  ↓
Connect to iCloud
  ↓
Fetch Recent Emails (IMAP)
  ↓
Parse Email Headers
  ↓
Load Stored Emails
  ↓
Merge & Deduplicate
  ↓
Save to JSON
  ↓
Close Connection
  ↓
Next: Analysis
```

### 2. Analysis Flow
```
Email Storage (JSON)
  ↓
Group by Sender
  ↓
Calculate Metrics:
  - Read rate
  - Frequency
  - Engagement
  ↓
Format for Claude
  ↓
Send to Claude API
  ↓
Parse Recommendations
  ↓
Generate Report
  ↓
Display Results
```

## Email Analysis Criteria

### Metrics Analyzed
| Metric | Calculation | Use Case |
|--------|-------------|----------|
| Read Rate | (Read Emails / Total) × 100 | Engagement level |
| Frequency | Days between emails | Sending pattern |
| Unread % | (Unread / Total) × 100 | Attention |
| Last Email | Most recent timestamp | Activity status |
| Subject Patterns | Unique subjects | Content repetition |

### Decision Matrix

```
┌─────────────────────┬────────────┬─────────────────┐
│ Read Rate           │ Frequency  │ Recommendation  │
├─────────────────────┼────────────┼─────────────────┤
│ < 20% (Low)         │ Any        │ DELETE          │
│ 20-50% (Medium)     │ < 3 days   │ UNSUBSCRIBE     │
│ 50-80% (Good)       │ Any        │ REVIEW          │
│ > 80% (High)        │ Any        │ KEEP            │
└─────────────────────┴────────────┴─────────────────┘
```

## Security Considerations

### Authentication
- App-specific passwords (not main account password)
- IMAP encryption (TLS)
- Local credential storage only

### Data Privacy
- Email bodies not sent to Claude (only headers)
- Local processing where possible
- No tracking or telemetry
- No third-party analytics

### Recommendations
1. Generate app-specific password for this app
2. Restrict API key permissions
3. Keep `.env` file out of version control
4. Review recommendations before actions
5. Audit generated reports

## Extension Points

### Custom Analysis Logic
Extend `EmailAnalysisAgent`:
```typescript
// Add domain-specific rules
async analyzeEmails(emails: Email[]): Promise<SubAgentAnalysis> {
  // Custom preprocessing
  // Domain logic
  // Custom Claude prompts
}
```

### Additional Senders
Extend `EmailScanner`:
```typescript
async scanFolder(folderName: string): Promise<Email[]> {
  // Support other folders
  // Archive analysis
  // Sent folder tracking
}
```

### Automated Actions
Implement in `index.ts`:
```typescript
if (analysis.recommendation === 'delete') {
  await emailClient.deleteEmails(senderEmails);
}
```

## Performance Considerations

### Scan Time Factors
- Number of emails: Linear O(n)
- API latency: ~5-10 seconds
- Storage I/O: Minimal

### Optimization Strategies
- Incremental scanning (only new emails)
- Batch API calls
- Cache analysis results
- Compress old data

### Typical Performance
| Operation | Time |
|-----------|------|
| Connect | 2-3s |
| Fetch 100 emails | 5-8s |
| Parse emails | 2-4s |
| Save data | 1-2s |
| Send to Claude | 5-10s |
| Total | ~15-30s |

## Future Architecture Enhancements

### Phase 2: UI & Automation
- Web dashboard for review
- Manual override interface
- Real-time notifications

### Phase 3: Machine Learning
- Model training per user
- Personalized thresholds
- Pattern learning

### Phase 4: Multi-Account
- Support Gmail, Outlook
- Unified dashboard
- Cross-platform sync

### Phase 5: Advanced Features
- Email classification
- Spam detection
- Phishing alerts
- VIP prioritization

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0
