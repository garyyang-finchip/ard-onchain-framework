# Vendored ARD material (placeholder)

The ERC text cannot hyperlink to the ARD specification site or repository: the ERCs repository's link linter only admits an allow-list of external domains. The ERC therefore names the specification without a link and relies on a pinned copy of the parts it depends on, vendored here under the upstream Apache-2.0 license.

To vendor before filing:

- `spec/schemas/` JSON Schema for the ARD entry (and CDDL / OpenAPI for the registry interface if the ERC text references them)
- the upstream `LICENSE` (Apache-2.0) and a `NOTICE` naming the ards-project working group and the exact spec version (v0.91) and commit

Nothing in this directory is normative for this ERC beyond what the ERC text explicitly cites.
