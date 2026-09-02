# Antlysis Loyalty Program API tests

This package is ready to import into the internal **Antlysis - Loyalty Program** Postman workspace. It exercises the API as a sequential acceptance flow: create isolated members, upload receipt evidence, validate ownership controls, make administrator decisions, and verify the resulting dashboard and voucher state.

## Import into Postman

1. Open the internal **Antlysis - Loyalty Program** workspace.
2. Select **Import** and import `Antlysis - Loyalty Program.postman_collection.json`.
3. Import either `Antlysis - Local.postman_environment.json` or `Antlysis - Production.postman_environment.json`.
4. Select the imported environment.
5. Set `admin_password` as a secret in your own Postman environment. The exported templates intentionally leave it empty.
6. In the desktop application, allow local-file access and reselect `fixtures/receipt-sample.pdf` or `fixtures/unsupported-receipt.txt` if Postman prompts for a file location.

Run the complete collection in numeric folder order. The setup request generates a unique run ID, member accounts, phone numbers, order IDs, and purchase date. Later requests retain authentication tokens and created resource IDs as collection variables.

## Coverage

| Folder | Coverage |
| --- | --- |
| 00 | Unique run data and service health/build identity |
| 01 | Email/phone registration, duplicate and invalid input, member login |
| 02 | Member profile, update validation, initial dashboard |
| 03 | Receipt uploads, duplicate order, amount/file validation |
| 04 | Receipt history, evidence download, ownership, missing resources |
| 05 | Administrator login, dashboard, queue, detail, evidence, filters |
| 06 | Approval, rejection, repeated decisions, invalid decisions |
| 07 | Final member/admin totals, receipt states, voucher issuance |
| 08 | Missing/invalid authentication, role controls, injection, malformed JSON, 404, logout |

The collection contains 53 requests and 137 assertions. It passed locally against an isolated Docker deployment on 2 September 2026.

## Production warning

The production environment targets `https://antlysis-loyalty.axelyn.com`. A complete run creates synthetic users and receipts, then permanently approves or rejects some of those receipts. Only run it against production when that test data is acceptable. The generated accounts use `@example.com` addresses and order IDs prefixed with `PM-` so they are easy to identify.

Do not place an administrator password or captured bearer token in a committed or shared environment export. Keep the password in Postman's local secret value or supply it only at runtime.

## Command-line run

From the repository root, with the application running locally:

```sh
npx -y newman run "postman/Antlysis - Loyalty Program.postman_collection.json" \
  -e "postman/Antlysis - Local.postman_environment.json" \
  --env-var "admin_password=YOUR_LOCAL_ADMIN_PASSWORD" \
  --working-dir "$PWD"
```

Use `--env-var "base_url=http://127.0.0.1:PORT"` when the local application is exposed on a non-default port.

## Regenerating the package

The JSON files are generated from `scripts/generate-collection.mjs`:

```sh
node postman/scripts/generate-collection.mjs
```

Manual browser UAT remains useful for visual layout, navigation, responsive behavior, accessible interaction, and the human review quality of uploaded evidence. Those areas are outside an HTTP collection's scope.
