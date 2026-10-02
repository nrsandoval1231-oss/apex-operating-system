# Workflow evidence

The n8n workflow JSON exports that used to sit in this folder
(`current_workflow.json`, `verified_workflow.json`, `final_verified_workflow.json`)
were removed from the working tree on 2026-10-02. They contained a JWT-shaped
n8n API token and named the live n8n host.

They remain in git history (introduced in `b325a3d`). History was not rewritten.
The owner must revoke that n8n API key. Its `exp` claim was 2026-08-28 17:00
America/Chicago, so it should already be invalid, and it still needs an explicit
revoke.
