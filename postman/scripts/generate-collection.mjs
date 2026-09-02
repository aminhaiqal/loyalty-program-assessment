import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("postman");
const collectionPath = path.join(root, "Antlysis - Loyalty Program.postman_collection.json");
const localEnvironmentPath = path.join(root, "Antlysis - Local.postman_environment.json");
const productionEnvironmentPath = path.join(root, "Antlysis - Production.postman_environment.json");

function scriptEvent(listen, lines) {
  if (!lines?.length) return null;
  return {
    listen,
    script: {
      type: "text/javascript",
      packages: {},
      // Postman/Newman can reuse a sandbox context across request scripts. Keep
      // top-level const/let declarations local to each script execution.
      exec: ["(function () {", ...lines.map((line) => `  ${line}`), "}());"],
    },
  };
}

function bearer(variable) {
  return {
    type: "bearer",
    bearer: [{ key: "token", value: `{{${variable}}}`, type: "string" }],
  };
}

function jsonBody(value) {
  return {
    mode: "raw",
    raw: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    options: { raw: { language: "json" } },
  };
}

function formBody(fields) {
  return {
    mode: "formdata",
    formdata: fields.map((field) => ({
      key: field.key,
      type: field.type || "text",
      ...(field.value !== undefined ? { value: field.value } : {}),
      ...(field.src ? { src: field.src } : {}),
      ...(field.contentType ? { contentType: field.contentType } : {}),
      ...(field.description ? { description: field.description } : {}),
    })),
  };
}

function item({ name, method = "GET", url, auth, body, tests = [], prerequest = [], description = "" }) {
  const events = [scriptEvent("prerequest", prerequest), scriptEvent("test", tests)].filter(Boolean);
  const headers = [
    { key: "Accept", value: "application/json", type: "text" },
    ...(body?.mode === "raw"
      ? [{ key: "Content-Type", value: "application/json", type: "text" }]
      : []),
  ];
  return {
    name,
    ...(events.length ? { event: events } : {}),
    request: {
      method,
      header: headers,
      ...(auth ? { auth: bearer(auth) } : { auth: { type: "noauth" } }),
      ...(body ? { body } : {}),
      url: `{{base_url}}${url}`,
      ...(description ? { description } : {}),
    },
    response: [],
  };
}

function folder(name, description, items) {
  return { name, description, item: items };
}

const expectStatus = (status) => [
  `pm.test("HTTP ${status}", function () { pm.response.to.have.status(${status}); });`,
];

const expectError = (status, code) => [
  ...expectStatus(status),
  "const data = pm.response.json();",
  `pm.test("Error code is ${code}", function () { pm.expect(data.error.code).to.eql("${code}"); });`,
  "pm.test(\"Error response is controlled\", function () { pm.expect(data.error.message).to.be.a(\"string\").and.not.empty; pm.expect(data).to.not.have.property(\"stack\"); });",
];

const fileFields = (orderVariable, amount = "42.50", token = "receipt-sample.pdf") => [
  { key: "orderId", value: `{{${orderVariable}}}` },
  { key: "purchaseDate", value: "{{purchase_date}}" },
  { key: "amount", value: amount },
  { key: "receipt", type: "file", src: `postman/fixtures/${token}`, contentType: token.endsWith(".pdf") ? "application/pdf" : "text/plain" },
];

const collection = {
  info: {
    _postman_id: crypto.randomUUID(),
    name: "Antlysis - Loyalty Program",
    description: [
      "Import-ready API acceptance suite for the Proof / Perk loyalty application.",
      "",
      "Run folders in numeric order. The first request generates unique synthetic users and order IDs. Request tests retain member/admin tokens, receipt IDs, and voucher identifiers as collection variables.",
      "",
      "The environment must provide base_url, admin_email, and admin_password. Never commit a populated production password or bearer token.",
      "",
      "Receipt upload requests reference postman/fixtures/receipt-sample.pdf. In the Postman desktop application, select that fixture again if Postman asks for local file permission.",
    ].join("\n"),
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: { type: "noauth" },
  variable: [
    { key: "base_url", value: "http://localhost:3000", type: "string" },
    { key: "member_password", value: "PostmanMember123!", type: "string" },
    { key: "run_id", value: "", type: "string" },
    { key: "member_email", value: "", type: "string" },
    { key: "other_member_email", value: "", type: "string" },
    { key: "phone_member_phone", value: "", type: "string" },
    { key: "member_phone", value: "", type: "string" },
    { key: "purchase_date", value: "", type: "string" },
    { key: "approval_order_id", value: "", type: "string" },
    { key: "rejection_order_id", value: "", type: "string" },
    { key: "other_order_id", value: "", type: "string" },
    { key: "invalid_order_id", value: "", type: "string" },
    { key: "member_token", value: "", type: "string" },
    { key: "other_member_token", value: "", type: "string" },
    { key: "admin_token", value: "", type: "string" },
    { key: "member_id", value: "", type: "string" },
    { key: "other_member_id", value: "", type: "string" },
    { key: "approval_receipt_id", value: "", type: "string" },
    { key: "rejection_receipt_id", value: "", type: "string" },
    { key: "other_member_receipt_id", value: "", type: "string" },
    { key: "voucher_id", value: "", type: "string" },
    { key: "voucher_code", value: "", type: "string" },
    { key: "missing_uuid", value: "00000000-0000-4000-8000-000000000001", type: "string" },
    { key: "rejection_reason", value: "Purchase information could not be verified.", type: "string" },
  ],
  item: [
    folder("00 - Run Setup", "Initialize unique test data and confirm the target build is healthy.", [
      item({
        name: "Initialize Run and Health Check",
        url: "/api/health",
        prerequest: [
          "const runId = `${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`.slice(-14);",
          "const phoneSuffix = runId.slice(-8);",
          "const yesterday = new Date(Date.now() - 86400000);",
          "const purchaseDate = [yesterday.getFullYear(), String(yesterday.getMonth() + 1).padStart(2, '0'), String(yesterday.getDate()).padStart(2, '0')].join('-');",
          "pm.collectionVariables.set('run_id', runId);",
          "pm.collectionVariables.set('member_email', `postman.member.a.${runId}@example.com`);",
          "pm.collectionVariables.set('other_member_email', `postman.member.b.${runId}@example.com`);",
          "pm.collectionVariables.set('phone_member_phone', `+6011${phoneSuffix}`);",
          "pm.collectionVariables.set('member_phone', `+6012${phoneSuffix}`);",
          "pm.collectionVariables.set('purchase_date', purchaseDate);",
          "pm.collectionVariables.set('approval_order_id', `PM-APP-${runId}`);",
          "pm.collectionVariables.set('rejection_order_id', `PM-REJ-${runId}`);",
          "pm.collectionVariables.set('other_order_id', `PM-OTH-${runId}`);",
          "pm.collectionVariables.set('invalid_order_id', `PM-INV-${runId}`);",
          "['member_token','other_member_token','admin_token','member_id','other_member_id','approval_receipt_id','rejection_receipt_id','other_member_receipt_id','voucher_id','voucher_code'].forEach((key) => pm.collectionVariables.unset(key));",
        ],
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Service is healthy\", function () { pm.expect(data.status).to.eql(\"ok\"); });",
          "pm.test(\"Build identity is present\", function () { pm.expect(data.version).to.be.a(\"string\").and.not.empty; pm.expect(data.commit).to.be.a(\"string\").and.not.empty; });",
          "console.log(`Postman run ${pm.collectionVariables.get('run_id')} targeting ${pm.variables.get('base_url')}`);",
        ],
        description: "Start every full collection run here. This request resets generated variables but never touches environment secrets.",
      }),
    ]),

    folder("01 - Authentication", "Create isolated test users and exercise positive and negative authentication paths.", [
      item({
        name: "Register Member A - Email",
        method: "POST",
        url: "/api/auth/register",
        body: jsonBody({ name: "Postman Member A", email: "{{member_email}}", password: "{{member_password}}" }),
        tests: [
          ...expectStatus(201),
          "const data = pm.response.json();",
          "pm.test(\"Member account is returned\", function () { pm.expect(data.user.role).to.eql(\"USER\"); pm.expect(data.user.email).to.eql(pm.collectionVariables.get('member_email')); });",
          "pm.test(\"Sensitive password fields are absent\", function () { pm.expect(data.user).to.not.have.property(\"password\"); pm.expect(data.user).to.not.have.property(\"password_hash\"); });",
          "pm.test(\"Bearer token is returned\", function () { pm.expect(data.token).to.be.a(\"string\").and.not.empty; });",
          "pm.collectionVariables.set('member_token', data.token);",
          "pm.collectionVariables.set('member_id', data.user.id);",
        ],
      }),
      item({
        name: "Register Member B - Email",
        method: "POST",
        url: "/api/auth/register",
        body: jsonBody({ name: "Postman Member B", email: "{{other_member_email}}", password: "{{member_password}}" }),
        tests: [
          ...expectStatus(201),
          "const data = pm.response.json();",
          "pm.test(\"Second member is isolated\", function () { pm.expect(data.user.id).to.not.eql(pm.collectionVariables.get('member_id')); pm.expect(data.user.role).to.eql(\"USER\"); });",
          "pm.collectionVariables.set('other_member_token', data.token);",
          "pm.collectionVariables.set('other_member_id', data.user.id);",
        ],
      }),
      item({
        name: "Register Phone-only Member",
        method: "POST",
        url: "/api/auth/register",
        body: jsonBody({ name: "Postman Phone Member", phone: "{{phone_member_phone}}", password: "{{member_password}}" }),
        tests: [
          ...expectStatus(201),
          "const data = pm.response.json();",
          "pm.test(\"Phone-only registration succeeds\", function () { pm.expect(data.user.phone).to.eql(pm.collectionVariables.get('phone_member_phone')); pm.expect(data.user.email).to.be.null; });",
        ],
      }),
      item({
        name: "Reject Duplicate Email Registration",
        method: "POST",
        url: "/api/auth/register",
        body: jsonBody({ name: "Duplicate", email: "{{member_email}}", password: "{{member_password}}" }),
        tests: expectError(409, "DUPLICATE_VALUE"),
      }),
      item({
        name: "Reject Registration Without Contact",
        method: "POST",
        url: "/api/auth/register",
        body: jsonBody({ name: "Missing Contact", password: "{{member_password}}" }),
        tests: expectError(400, "VALIDATION_ERROR"),
      }),
      item({
        name: "Reject Invalid Email Registration",
        method: "POST",
        url: "/api/auth/register",
        body: jsonBody({ email: "not-an-email", password: "{{member_password}}" }),
        tests: expectError(400, "VALIDATION_ERROR"),
      }),
      item({
        name: "Reject Short Password",
        method: "POST",
        url: "/api/auth/register",
        body: jsonBody({ email: "short.{{run_id}}@example.com", password: "short" }),
        tests: expectError(400, "VALIDATION_ERROR"),
      }),
      item({
        name: "Login Member A",
        method: "POST",
        url: "/api/auth/login",
        body: jsonBody({ identifier: "{{member_email}}", password: "{{member_password}}" }),
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Member login returns USER role\", function () { pm.expect(data.user.role).to.eql(\"USER\"); });",
          "pm.collectionVariables.set('member_token', data.token);",
        ],
      }),
      item({
        name: "Login Member B",
        method: "POST",
        url: "/api/auth/login",
        body: jsonBody({ identifier: "{{other_member_email}}", password: "{{member_password}}" }),
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.collectionVariables.set('other_member_token', data.token);",
        ],
      }),
      item({
        name: "Reject Invalid Login",
        method: "POST",
        url: "/api/auth/login",
        body: jsonBody({ identifier: "{{member_email}}", password: "WrongPassword123!" }),
        tests: expectError(401, "INVALID_CREDENTIALS"),
      }),
    ]),

    folder("02 - Member Profile and Dashboard", "Verify member profile behavior before receipt data changes the dashboard.", [
      item({
        name: "Get Member A Profile",
        url: "/api/user/profile",
        auth: "member_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Profile belongs to Member A\", function () { pm.expect(data.user.id).to.eql(pm.collectionVariables.get('member_id')); pm.expect(data.user.role).to.eql(\"USER\"); });",
          "pm.test(\"Password hash is never exposed\", function () { pm.expect(data.user).to.not.have.property(\"password_hash\"); });",
        ],
      }),
      item({
        name: "Update Member A Profile",
        method: "PUT",
        url: "/api/user/profile",
        auth: "member_token",
        body: jsonBody({ name: "Postman Member A Updated", email: "{{member_email}}", phone: "{{member_phone}}" }),
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Profile changes persist\", function () { pm.expect(data.user.name).to.eql(\"Postman Member A Updated\"); pm.expect(data.user.phone).to.eql(pm.collectionVariables.get('member_phone')); });",
        ],
      }),
      item({
        name: "Reject Profile Without Contact",
        method: "PUT",
        url: "/api/user/profile",
        auth: "member_token",
        body: jsonBody({ email: "", phone: "" }),
        tests: expectError(400, "VALIDATION_ERROR"),
      }),
      item({
        name: "Initial Member Dashboard",
        url: "/api/user/dashboard",
        auth: "member_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"New member starts with zero activity\", function () { pm.expect(data.pendingReceipts).to.eql(0); pm.expect(data.approvedReceipts).to.eql(0); pm.expect(data.availableVouchers).to.eql(0); });",
        ],
      }),
    ]),

    folder("03 - Receipt Submission", "Create two Member A receipts for approval/rejection and one Member B receipt for ownership tests.", [
      item({
        name: "Upload Approval Receipt - Member A",
        method: "POST",
        url: "/api/receipts",
        auth: "member_token",
        body: formBody(fileFields("approval_order_id")),
        tests: [
          ...expectStatus(201),
          "const data = pm.response.json();",
          "pm.test(\"New receipt is pending\", function () { pm.expect(data.receipt.status).to.eql(\"PENDING\"); pm.expect(data.receipt.orderId).to.eql(pm.collectionVariables.get('approval_order_id')); });",
          "pm.collectionVariables.set('approval_receipt_id', data.receipt.id);",
        ],
      }),
      item({
        name: "Upload Rejection Receipt - Member A",
        method: "POST",
        url: "/api/receipts",
        auth: "member_token",
        body: formBody(fileFields("rejection_order_id", "18.75")),
        tests: [
          ...expectStatus(201),
          "const data = pm.response.json();",
          "pm.test(\"Second receipt is pending\", function () { pm.expect(data.receipt.status).to.eql(\"PENDING\"); });",
          "pm.collectionVariables.set('rejection_receipt_id', data.receipt.id);",
        ],
      }),
      item({
        name: "Upload Receipt - Member B",
        method: "POST",
        url: "/api/receipts",
        auth: "other_member_token",
        body: formBody(fileFields("other_order_id", "31.20")),
        tests: [
          ...expectStatus(201),
          "const data = pm.response.json();",
          "pm.collectionVariables.set('other_member_receipt_id', data.receipt.id);",
        ],
      }),
      item({
        name: "Reject Duplicate Order ID",
        method: "POST",
        url: "/api/receipts",
        auth: "member_token",
        body: formBody(fileFields("approval_order_id")),
        tests: expectError(409, "DUPLICATE_ORDER"),
      }),
      item({
        name: "Reject Invalid Amount",
        method: "POST",
        url: "/api/receipts",
        auth: "member_token",
        body: formBody(fileFields("invalid_order_id", "0.00")),
        tests: expectError(400, "VALIDATION_ERROR"),
      }),
      item({
        name: "Reject Missing Receipt File",
        method: "POST",
        url: "/api/receipts",
        auth: "member_token",
        body: formBody([
          { key: "orderId", value: "PM-NOFILE-{{run_id}}" },
          { key: "purchaseDate", value: "{{purchase_date}}" },
          { key: "amount", value: "12.00" },
        ]),
        tests: expectError(400, "VALIDATION_ERROR"),
      }),
      item({
        name: "Reject Unsupported File Type",
        method: "POST",
        url: "/api/receipts",
        auth: "member_token",
        body: formBody(fileFields("invalid_order_id", "12.00", "unsupported-receipt.txt")),
        tests: expectError(400, "INVALID_FILE"),
      }),
    ]),

    folder("04 - Receipt History and Ownership", "Verify member-scoped data and protected evidence retrieval.", [
      item({
        name: "List Member A Receipts",
        url: "/api/receipts",
        auth: "member_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "const ids = data.receipts.map((receipt) => receipt.id);",
          "pm.test(\"Member A sees both own receipts\", function () { pm.expect(ids).to.include(pm.collectionVariables.get('approval_receipt_id')); pm.expect(ids).to.include(pm.collectionVariables.get('rejection_receipt_id')); });",
          "pm.test(\"Member A cannot see Member B receipt\", function () { pm.expect(ids).to.not.include(pm.collectionVariables.get('other_member_receipt_id')); });",
          "pm.test(\"Own receipts remain pending\", function () { pm.expect(data.receipts.every((receipt) => receipt.status === 'PENDING')).to.be.true; });",
        ],
      }),
      item({
        name: "Download Own Receipt",
        url: "/api/receipts/{{approval_receipt_id}}/file",
        auth: "member_token",
        tests: [
          ...expectStatus(200),
          "pm.test(\"Download metadata is present\", function () { pm.expect(pm.response.headers.has('Content-Disposition')).to.be.true; pm.expect(pm.response.headers.get('Content-Type')).to.include('application/pdf'); });",
        ],
      }),
      item({
        name: "Forbid Member B From Member A Receipt",
        url: "/api/receipts/{{approval_receipt_id}}/file",
        auth: "other_member_token",
        tests: expectError(403, "FORBIDDEN"),
      }),
      item({
        name: "Reject Invalid Receipt ID",
        url: "/api/receipts/not-a-uuid/file",
        auth: "member_token",
        tests: expectError(400, "VALIDATION_ERROR"),
      }),
      item({
        name: "Return Not Found for Missing Receipt",
        url: "/api/receipts/{{missing_uuid}}/file",
        auth: "member_token",
        tests: expectError(404, "NOT_FOUND"),
      }),
      item({
        name: "Initial Member Vouchers",
        url: "/api/user/vouchers",
        auth: "member_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Pending receipts create no vouchers\", function () { pm.expect(data.vouchers).to.be.an('array').that.is.empty; });",
        ],
      }),
    ]),

    folder("05 - Admin Authentication and Queue", "Authenticate the configured administrator and inspect pending evidence.", [
      item({
        name: "Login Administrator",
        method: "POST",
        url: "/api/auth/login",
        body: jsonBody({ identifier: "{{admin_email}}", password: "{{admin_password}}" }),
        prerequest: [
          "if (!pm.environment.get('admin_email') || !pm.environment.get('admin_password')) { throw new Error('Set admin_email and admin_password in the selected Postman environment.'); }",
        ],
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Administrator role is returned\", function () { pm.expect(data.user.role).to.eql(\"ADMIN\"); });",
          "pm.collectionVariables.set('admin_token', data.token);",
        ],
      }),
      item({
        name: "Admin Dashboard Before Decisions",
        url: "/api/admin/dashboard",
        auth: "admin_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Dashboard counters are numeric\", function () { ['pendingReceipts','approvedReceipts','rejectedReceipts','vouchersIssued'].forEach((key) => pm.expect(data[key]).to.be.a('number')); });",
          "pm.test(\"Created receipts are counted as pending\", function () { pm.expect(data.pendingReceipts).to.be.at.least(3); });",
        ],
      }),
      item({
        name: "Forbid Member From Admin Dashboard",
        url: "/api/admin/dashboard",
        auth: "member_token",
        tests: expectError(403, "FORBIDDEN"),
      }),
      item({
        name: "List Pending Receipt Queue",
        url: "/api/admin/receipts?status=PENDING",
        auth: "admin_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "const ids = data.receipts.map((receipt) => receipt.id);",
          "pm.test(\"All generated pending receipts are visible\", function () { ['approval_receipt_id','rejection_receipt_id','other_member_receipt_id'].forEach((key) => pm.expect(ids).to.include(pm.collectionVariables.get(key))); });",
          "pm.test(\"Queue includes member and evidence metadata\", function () { const receipt = data.receipts.find((row) => row.id === pm.collectionVariables.get('approval_receipt_id')); pm.expect(receipt.fileName).to.be.a('string').and.not.empty; pm.expect(receipt.userEmail).to.eql(pm.collectionVariables.get('member_email')); });",
        ],
      }),
      item({
        name: "Get Approval Receipt Detail",
        url: "/api/admin/receipts/{{approval_receipt_id}}",
        auth: "admin_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Correct pending receipt is returned\", function () { pm.expect(data.receipt.id).to.eql(pm.collectionVariables.get('approval_receipt_id')); pm.expect(data.receipt.status).to.eql('PENDING'); });",
        ],
      }),
      item({
        name: "Download Receipt as Administrator",
        url: "/api/receipts/{{approval_receipt_id}}/file",
        auth: "admin_token",
        tests: expectStatus(200),
      }),
      item({
        name: "Reject Invalid Queue Filter",
        url: "/api/admin/receipts?status=UNKNOWN",
        auth: "admin_token",
        tests: expectError(400, "VALIDATION_ERROR"),
      }),
    ]),

    folder("06 - Receipt Decisions", "Exercise the one-way decision state machine and one-voucher invariant.", [
      item({
        name: "Approve Pending Receipt",
        method: "PATCH",
        url: "/api/admin/receipts/{{approval_receipt_id}}/decision",
        auth: "admin_token",
        body: jsonBody({ decision: "APPROVE" }),
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Receipt becomes approved\", function () { pm.expect(data.receipt.status).to.eql('APPROVED'); pm.expect(data.receipt.processedAt).to.be.a('string').and.not.empty; pm.expect(data.receipt.rejectionReason).to.be.null; });",
          "pm.test(\"Exactly one voucher is returned\", function () { pm.expect(data.voucher.receiptId).to.eql(pm.collectionVariables.get('approval_receipt_id')); pm.expect(data.voucher.code).to.match(/^VCH-[A-F0-9]{24}$/); });",
          "pm.collectionVariables.set('voucher_id', data.voucher.id);",
          "pm.collectionVariables.set('voucher_code', data.voucher.code);",
        ],
      }),
      item({
        name: "Reject Repeated Approval",
        method: "PATCH",
        url: "/api/admin/receipts/{{approval_receipt_id}}/decision",
        auth: "admin_token",
        body: jsonBody({ decision: "APPROVE" }),
        tests: expectError(409, "ALREADY_PROCESSED"),
      }),
      item({
        name: "Reject Pending Receipt",
        method: "PATCH",
        url: "/api/admin/receipts/{{rejection_receipt_id}}/decision",
        auth: "admin_token",
        body: jsonBody({ decision: "REJECT", rejectionReason: "{{rejection_reason}}" }),
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Receipt becomes rejected\", function () { pm.expect(data.receipt.status).to.eql('REJECTED'); pm.expect(data.receipt.rejectionReason).to.eql(pm.collectionVariables.get('rejection_reason')); });",
          "pm.test(\"Rejection creates no voucher\", function () { pm.expect(data.voucher).to.be.null; });",
        ],
      }),
      item({
        name: "Reject Repeated Rejection",
        method: "PATCH",
        url: "/api/admin/receipts/{{rejection_receipt_id}}/decision",
        auth: "admin_token",
        body: jsonBody({ decision: "REJECT" }),
        tests: expectError(409, "ALREADY_PROCESSED"),
      }),
      item({
        name: "Reject Unsupported Decision",
        method: "PATCH",
        url: "/api/admin/receipts/{{other_member_receipt_id}}/decision",
        auth: "admin_token",
        body: jsonBody({ decision: "HOLD" }),
        tests: expectError(400, "VALIDATION_ERROR"),
      }),
      item({
        name: "Return Not Found for Missing Decision Target",
        method: "PATCH",
        url: "/api/admin/receipts/{{missing_uuid}}/decision",
        auth: "admin_token",
        body: jsonBody({ decision: "APPROVE" }),
        tests: expectError(404, "NOT_FOUND"),
      }),
    ]),

    folder("07 - Post-decision Verification", "Confirm member/admin views reflect the recorded decisions and voucher.", [
      item({
        name: "Member Dashboard After Decisions",
        url: "/api/user/dashboard",
        auth: "member_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Member totals reflect one approval and one rejection\", function () { pm.expect(data.pendingReceipts).to.eql(0); pm.expect(data.approvedReceipts).to.eql(1); pm.expect(data.availableVouchers).to.eql(1); });",
        ],
      }),
      item({
        name: "Member Receipt History After Decisions",
        url: "/api/receipts",
        auth: "member_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "const approved = data.receipts.find((receipt) => receipt.id === pm.collectionVariables.get('approval_receipt_id'));",
          "const rejected = data.receipts.find((receipt) => receipt.id === pm.collectionVariables.get('rejection_receipt_id'));",
          "pm.test(\"Receipt statuses are final\", function () { pm.expect(approved.status).to.eql('APPROVED'); pm.expect(rejected.status).to.eql('REJECTED'); pm.expect(rejected.rejectionReason).to.eql(pm.collectionVariables.get('rejection_reason')); });",
        ],
      }),
      item({
        name: "Member Voucher After Approval",
        url: "/api/user/vouchers",
        auth: "member_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Exactly one voucher exists\", function () { pm.expect(data.vouchers).to.have.length(1); });",
          "pm.test(\"Voucher traces to the source receipt\", function () { const voucher = data.vouchers[0]; pm.expect(voucher.id).to.eql(pm.collectionVariables.get('voucher_id')); pm.expect(voucher.code).to.eql(pm.collectionVariables.get('voucher_code')); pm.expect(voucher.receiptId).to.eql(pm.collectionVariables.get('approval_receipt_id')); pm.expect(voucher.orderId).to.eql(pm.collectionVariables.get('approval_order_id')); });",
        ],
      }),
      item({
        name: "Admin Dashboard After Decisions",
        url: "/api/admin/dashboard",
        auth: "admin_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Program totals include the generated outcomes\", function () { pm.expect(data.pendingReceipts).to.be.at.least(1); pm.expect(data.approvedReceipts).to.be.at.least(1); pm.expect(data.rejectedReceipts).to.be.at.least(1); pm.expect(data.vouchersIssued).to.be.at.least(1); });",
        ],
      }),
      item({
        name: "Approved Queue Contains Receipt",
        url: "/api/admin/receipts?status=APPROVED",
        auth: "admin_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Approved filter includes generated receipt\", function () { pm.expect(data.receipts.map((receipt) => receipt.id)).to.include(pm.collectionVariables.get('approval_receipt_id')); });",
        ],
      }),
      item({
        name: "Rejected Queue Contains Receipt",
        url: "/api/admin/receipts?status=REJECTED",
        auth: "admin_token",
        tests: [
          ...expectStatus(200),
          "const data = pm.response.json();",
          "pm.test(\"Rejected filter includes generated receipt\", function () { pm.expect(data.receipts.map((receipt) => receipt.id)).to.include(pm.collectionVariables.get('rejection_receipt_id')); });",
        ],
      }),
    ]),

    folder("08 - Security and Error Responses", "Verify unauthenticated access, malformed input, injection resistance, and controlled errors.", [
      item({
        name: "Reject Profile Without Authentication",
        url: "/api/user/profile",
        tests: expectError(401, "UNAUTHENTICATED"),
      }),
      item({
        name: "Reject Invalid Bearer Token",
        url: "/api/user/profile",
        auth: "invalid_token",
        prerequest: ["pm.collectionVariables.set('invalid_token', 'not-a-valid-jwt');"],
        tests: expectError(401, "UNAUTHENTICATED"),
      }),
      item({
        name: "Reject SQL Injection Login",
        method: "POST",
        url: "/api/auth/login",
        body: jsonBody({ identifier: "' OR 1=1 --", password: "anything" }),
        tests: expectError(401, "INVALID_CREDENTIALS"),
      }),
      item({
        name: "Reject Malformed JSON",
        method: "POST",
        url: "/api/auth/login",
        body: jsonBody('{"identifier":'),
        tests: expectError(400, "VALIDATION_ERROR"),
      }),
      item({
        name: "Return Not Found for Unknown API Route",
        url: "/api/does-not-exist",
        tests: expectError(404, "NOT_FOUND"),
      }),
      item({
        name: "Logout Member",
        method: "POST",
        url: "/api/auth/logout",
        auth: "member_token",
        tests: expectStatus(204),
        description: "JWT logout is intentionally client-side. This endpoint provides the conventional 204 API target; the client removes its token.",
      }),
    ]),
  ],
};

function environment(name, baseUrl, adminEmail) {
  return {
    id: crypto.randomUUID(),
    name,
    values: [
      { key: "base_url", value: baseUrl, type: "default", enabled: true },
      { key: "admin_email", value: adminEmail, type: "default", enabled: true },
      { key: "admin_password", value: "", type: "secret", enabled: true },
    ],
    _postman_variable_scope: "environment",
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: "Codex",
  };
}

fs.writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`);
fs.writeFileSync(localEnvironmentPath, `${JSON.stringify(environment("Antlysis - Local", "http://localhost:3000", "admin@example.com"), null, 2)}\n`);
fs.writeFileSync(productionEnvironmentPath, `${JSON.stringify(environment("Antlysis - Production", "https://antlysis-loyalty.axelyn.com", "admin@antlysis.com"), null, 2)}\n`);

console.log(`Generated ${collectionPath}`);
console.log(`Generated ${localEnvironmentPath}`);
console.log(`Generated ${productionEnvironmentPath}`);
