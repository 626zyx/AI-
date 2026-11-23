# Regional Knowledge Base: APAC Customer Support Notes

## Supported Languages in APAC Region
- Japanese: Full support (business hours JST)
- Korean: Full support (business hours KST)
- Mandarin Chinese: Full support (business hours CST)
- English: 24/7 support coverage
- Thai: Limited support (partner-assisted)
- Vietnamese: Limited support (partner-assisted)

## Regional Deployment Options
CloudSync operates relay nodes in the following APAC locations:
- Tokyo (ap-northeast-1)
- Seoul (ap-northeast-2)
- Singapore (ap-southeast-1)
- Sydney (ap-southeast-2)
- Mumbai (ap-south-1)

## Common APAC-Specific Issues

### Great Firewall Connectivity
Chinese mainland customers may experience degraded sync performance. Recommend deploying a dedicated relay in Hong Kong for improved connectivity. Workaround: configure client to use HK relay explicitly via Settings > Network > Custom Relay.

### Japanese Character Encoding
Full support for Shift-JIS, EUC-JP, and UTF-8 file names. If customers report garbled file names, verify the client locale is set correctly: `cloudsync config set locale ja_JP.UTF-8`.

### APAC Business Hours Coverage
Standard support hours by timezone:
- JST: 9:00-18:00 (English, Japanese)
- KST: 9:00-18:00 (English, Korean)
- CST: 9:00-18:00 (English, Mandarin)
- IST: 9:00-18:00 (English only)

Outside business hours, APAC tickets are routed to US-West team for English-language support.
