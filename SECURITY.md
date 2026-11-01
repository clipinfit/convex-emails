# Security

Report vulnerabilities through GitHub's private vulnerability reporting feature if enabled. Otherwise, contact the maintainer through their GitHub profile before disclosing sensitive details. Do not include credentials or real message bodies in a public issue.

Keep provider keys in the host Convex environment. Do not pass secrets in enqueue arguments or store them in message headers. Restrict sender domains and recipient permissions in the application. Component APIs are trusted server APIs, not authenticated end-user endpoints.

The component persists recipients, subjects, HTML, optional text, and selected delivery events. Protect access to status queries and exports. Choose an application retention policy. Cleanup preserves restrictions and unresolved records but removes business-key deduplication for deleted records.

Resend webhook authentication uses Svix signatures and timestamp checks. Plunk workflow authentication uses a shared bearer secret. Request bodies are limited to 64 KiB. Sends require HTTPS and reject redirects.

A custom adapter is trusted server code. Review its credentials, endpoint, request mapping, retry window, and event verification before enabling it.
