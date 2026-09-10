# Proof / Perk — Interview speaking guide

Open `Proof-and-Perk-Interview.pptx` in LibreOffice Impress or PowerPoint. Each slide has detailed speaker notes, transitions, source references and likely follow-up questions. The PDF is a presentation backup; it does not include the notes.

The deck has 12 slides. Aim for approximately 8 minutes on slides 1–8, then 4–5 minutes for your live demo on slide 9. Finish with the three short journey recaps on slides 10–12 (15–20 seconds each). Rehearse the ideas rather than memorizing every sentence.

## 1. Requirements — 50 seconds

“Good morning, I’m Amin. I’ll walk through the requirements, my design decisions and the controls behind receipt approval. Then I’ll demonstrate the complete workflow.”

Explain the two roles: members submit receipts and track rewards; administrators validate the evidence. State the central rule: one approved receipt creates one voucher; rejection creates none. Mention the required React, Express and PostgreSQL stack. OTP, voucher redemption and expiry were not required.

Transition: “Those requirements led to a simple workflow with two final outcomes.”

## 2. Workflow — 45 seconds

Explain PENDING → APPROVED or REJECTED. Decisions are final in the current application. Show how the member follows progress through receipt history, while the administrator works through the pending queue.

Transition: “The API enforces these rules, so the workflow does not depend on the UI.”

## 3. Architecture — 60 seconds

Explain responsibilities: React handles interaction; Express handles access and business rules; PostgreSQL stores records and constraints. File bytes live in a private upload volume, with metadata in PostgreSQL. Retrieval requires an authenticated API call.

Why raw SQL? The model is small, parameterized queries are explicit, and the transaction is easy to inspect. Why one application? It keeps delivery and transaction handling manageable for the assessment.

Transition: “The data model reflects the same receipt-to-voucher relationship.”

## 4. Database — 60 seconds

A user owns many receipts. Each receipt has zero or one voucher. Foreign keys connect the records; a unique order ID per member prevents duplicate submissions. The unique voucher receipt reference prevents duplicates. Amounts use `NUMERIC(12,2)`.

Be precise: the unique constraint guarantees *at most one* voucher; the approval transaction creates the voucher together with a successful approval.

Transition: “The transaction makes approval and voucher creation succeed together.”

## 5. Approval transaction — 80 seconds

Explain BEGIN → row lock → pending check → update and insert → COMMIT. On failure, ROLLBACK reverses the transaction.

For simultaneous approvals, the second request waits for the lock. After the first commits, the second sees APPROVED and returns `409 ALREADY_PROCESSED`. Rejection skips the voucher insert.

Code to open if asked: `server/src/services/receipt-decision.js`.

Transition: “Permissions also need to be checked on the server.”

## 6. Security — 65 seconds

Discuss bcrypt at cost 12, eight-hour JWTs, role checks from the database, ownership filtering, parameterized SQL, required fields and the 5 MB upload limit. Explain `401` versus `403`.

Know the limits: logout clears the local token but does not revoke a copied token. MIME/extension checking is not malware scanning or file-signature verification. These are potential improvements, not implemented features.

Transition: “I checked the normal journey and the failure cases.”

## 7. Testing — 50 seconds

The recorded verification on 2 September 2026 passed 9 automated tests and 137 assertions across 53 Postman requests. Explain what these check rather than only quoting the numbers. The unit tests use a fake database; the Postman collection was run against a local Docker deployment.

Your completed manual UAT record is supplied separately. Describe its results according to the document you actually completed. The repository copy is a template.

Transition: “I also made the project easy for another developer to run.”

## 8. Delivery and your contribution — 70 seconds

Explain `make`, Docker startup, schema/admin initialization and the CI/CD workflow. Mention HTTPS on the VPS and commit/version verification after deployment.

Your contribution includes the technical brief, requirements, UX direction, review and UAT. Explain how AI helped with implementation, tests, documentation and configuration. The README uses an estimated 60% personal / 40% AI-assisted contribution; this is not a measured code-authorship statistic. Use concrete examples of work you personally did and decisions you can explain.

Potential next steps: object storage, versioned migrations, rate limiting and session revocation. The current schema runner is repeatable initialization, not a full migration framework.

Transition: “Now I’ll demonstrate how those pieces work together.”

## 9. Your live demo — 4–5 minutes

1. Member: show the overview, open Receipt history → New receipt, upload a sample and point out PENDING.
2. Administrator: open the pending queue, retrieve the file and approve the receipt.
3. Member: refresh history, show APPROVED, then show the voucher and its source order.
4. Administrator/member: reject a second pending receipt with a reason, then show REJECTED and confirm the voucher count has not increased.

If time permits, repeat approval in Postman and show `409 ALREADY_PROCESSED`.

Close: “That demonstrates the key rules: every receipt starts pending, only an administrator decides, and each successful approval creates one traceable voucher. I’m happy to walk through the transaction code or database design.”

## 10. Member submits a receipt — 15–20 seconds

“The member uploads the file and purchase details. The receipt enters the review queue as PENDING. No voucher is issued yet.”

## 11. Admin approves a receipt — 15–20 seconds

“The administrator reviews the evidence and approves the receipt. The member receives exactly one voucher linked to that receipt. Repeating the decision cannot create another.”

## 12. Admin rejects a receipt — 15–20 seconds

“The administrator rejects the receipt. The member sees REJECTED and any recorded reason. No voucher is issued.”

Take questions after these three recaps.

## Before the interview

- Open member and admin in separate browser profiles or normal/private windows. Two normal tabs share the same localStorage token.
- Prepare synthetic receipt files, unique order IDs, valid past purchase dates and a second pending receipt for rejection.
- Check both logins and the site before presenting. Keep credentials and bearer tokens off screen.
- Have the local Docker app running as a fallback. Avoid waiting for a fresh build during the interview.
- Have the transaction source, database schema, Postman collection and completed UAT record ready for questions.
- Practice the member refresh after each administrator decision; the pages do not update through a live subscription.
