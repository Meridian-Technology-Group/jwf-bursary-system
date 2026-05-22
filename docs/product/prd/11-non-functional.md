### 3.2 Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NF-01 | **Performance** | Page load time (applicant portal) | < 2 seconds on 4G connection |
| NF-02 | **Performance** | Assessment calculation execution | < 1 second after assessor submits data |
| NF-03 | **Performance** | Document upload | Support files up to 20 MB; upload completes within 30 seconds on broadband |
| NF-04 | **Availability** | Uptime | 99.5% (excluding planned maintenance windows) |
| NF-05 | **Scalability** | Concurrent users | Support up to 50 concurrent applicant portal sessions and 5 concurrent admin sessions |
| NF-06 | **Security** | Authentication | Password hashing (bcrypt/argon2), MFA for admin, rate-limited login attempts, account lockout after repeated failures |
| NF-07 | **Security** | Authorisation | Role-based access control. Applicants can only access their own application. Admins can access all applications within their permissions. |
| NF-08 | **Security** | Data protection | OWASP Top 10 compliance. Input validation and output encoding to prevent XSS, SQL injection, CSRF. Content Security Policy headers. |
| NF-09 | **Security** | Document access | Pre-signed, time-limited URLs for document viewing. No direct public access to stored files. |
| NF-10 | **Security** | Virus scanning | All uploaded files scanned for malware before storage. |
| NF-11 | **Accessibility** | WCAG compliance | WCAG 2.1 Level AA for the applicant portal. |
| NF-12 | **Browser support** | Supported browsers | Latest 2 versions of Chrome, Firefox, Safari, Edge. Mobile Safari and Chrome on iOS/Android. |
| NF-13 | **Backup** | Data backup | Daily automated backups with 30-day retention. Point-in-time recovery capability. |
| NF-14 | **Data residency** | Hosting location | UK data centre (GDPR compliance for UK personal data). |
| NF-15 | **Maintainability** | Deployment | Zero-downtime deployments. Staging environment for pre-production testing. |
| NF-16 | **Security** | Data minimisation | Personal identifiers (names, email addresses) are masked by default in assessment and reporting contexts. Revealed only in contexts where identification is necessary (applicant detail, communication, recommendation export). See functional requirements NM-01 through NM-05. |

---
