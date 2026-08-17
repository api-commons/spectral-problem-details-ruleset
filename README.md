# @api-common/spectral-problem-details-ruleset

A curated, **owned**, **grounded** [Spectral](https://github.com/stoplightio/spectral)
ruleset for **[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457), Problem Details for
HTTP APIs** — check that your error responses are actually problem details, in one line.

An [API Commons](https://apicommons.org) tool. Pairs with the
[Problem Details base OpenAPI](https://github.com/api-commons/problem-details-for-http-apis)
and the [Error Codes](https://apicommons.org/common/error-codes/) property.

## Adopt it

```yaml
# .spectral.yml
extends:
  - https://raw.githubusercontent.com/api-commons/spectral-problem-details-ruleset/main/problem-details.yaml
```

Or run it directly:

```
spectral lint openapi.yaml -r https://raw.githubusercontent.com/api-commons/spectral-problem-details-ruleset/main/problem-details.yaml
```

Every rule uses Spectral's **built-in functions only** — no custom JavaScript — so it runs
anywhere Spectral runs, including in a browser.

## Why a problem details ruleset

RFC 9457 exists so that nobody has to invent another error format. The value only arrives
if a consumer can *recognise* the format, and most of the ways an API fails to deliver
that are invisible in review:

> "If a member's value type does not match the specified type, the member **MUST be
> ignored** — i.e., processing will continue as if the member had not been present."
> — [RFC 9457 §3.1](https://www.rfc-editor.org/rfc/rfc9457#section-3.1)

That is the sentence this ruleset is built around. A `status` declared as a string does
not throw at the consumer. It **vanishes**. Every type rule below is guarding against a
member being silently dropped by a conforming client.

## The rules

16 rules. Ids are stable; each carries a `documentationUrl` pointing at the specific RFC
section rather than at a homepage.

| Rule | Severity | Grounding |
| --- | --- | --- |
| `problem-details-error-response-media-type` | warn | §3 — 4xx/5xx should offer `application/problem+json` or `+xml` |
| `problem-details-schema-is-object` | error | §3 — a problem detail is a JSON object |
| `problem-details-type-member-defined` | warn | §3.1.1 — `type` is the problem type's primary identifier |
| `problem-details-title-member-defined` | warn | §3.1.3 — the human-readable summary |
| `problem-details-type-is-string` | error | §3.1.1 — `type` is a JSON string |
| `problem-details-status-is-number` | error | §3.1.2 — `status` is a JSON **number** |
| `problem-details-detail-is-string` | error | §3.1.4 |
| `problem-details-instance-is-string` | error | §3.1.5 |
| `problem-details-allows-extension-members` | warn | §3.2 — `additionalProperties: false` forbids extensions |
| `problem-details-type-format-uri` | info | §3.1.1 — declare `format: uri` |
| `problem-details-example-type-absolute-uri` | info | §3.1.1 — absolute type URIs are RECOMMENDED |
| `problem-details-response-has-example` | info | ship an example |
| `problem-details-401-www-authenticate` | warn | RFC 9110 §11.6.1 |
| `problem-details-429-retry-after` | warn | RFC 9110 §10.2.3 |
| `problem-details-no-implementation-leakage` | warn | §5 — no stack traces in the contract |
| `problem-details-cites-obsoleted-rfc7807` | info | RFC 7807 was obsoleted July 2023 |

### The two rules worth the install on their own

**`problem-details-allows-extension-members`.** RFC 9457 §3.2 lets problem types add
their own members and requires consumers to ignore ones they don't recognise — that is
the whole evolution story for the format. Several schema generators emit
`additionalProperties: false` by default, which forbids it outright. Nobody catches this
in review, and it quietly caps the format at five fields forever.

**`problem-details-status-is-number`.** `status` declared as a string is the most common
problem detail defect in the wild, and per §3.1 it fails *silently* at every conforming
consumer.

## What this ruleset deliberately does not do

**It does not check that `status` matches the response's HTTP status code.** RFC 9457
§3.1.2 requires generators to use the same code in both, and §5 raises the disagreement
as a security consideration — but comparing a response key (`"404"`) against a value
nested inside that response's example is not expressible with Spectral's built-in
functions. It is a runtime check. We flag it here as a **residual** rather than shipping a
rule that only appears to cover it.

**It does not flag `urn:ietf:rfc:7807`.** RFC 9457 Appendix B *retained* that namespace
for the XML serialization. A document using it is correct, not stale — only prose and
link references naming RFC 7807 as the governing specification are flagged.
`fixtures/clean.yaml` carries the namespace specifically to prove the regex doesn't
over-match, and the test suite fails if it ever does.

**OpenAPI 3.x only.** Swagger 2.0 has no `content` map — problem media types are
expressed through `produces` — so the structural rules here have no honest 2.0 twin.
Rather than ship weaker lookalikes, 2.0 is out of scope.

## Tests

```
npm install
npm test
```

The harness asserts three things:

1. **Every declared rule fires** on `fixtures/noncompliant.yaml`. A rule nobody can
   trigger is a rule that does not work — this caught four such rules during development.
2. **`fixtures/clean.yaml` is completely silent.**
3. **No rule throws** while linting either document.

It parses rule ids straight out of the ruleset, so adding a rule without giving it a
fixture case fails the build.

## It finds real defects in our own artifacts

Run against the API Commons
[Problem Details base OpenAPI](https://github.com/api-commons/problem-details-for-http-apis)
at the time this ruleset was written:

```
error  problem-details-schema-is-object          components.schemas.Problem
warn   problem-details-401-www-authenticate      components.responses.Unauthorized.headers
info   problem-details-cites-obsoleted-rfc7807   externalDocs.url
info   problem-details-type-format-uri           components.schemas.Problem.properties.type
```

The base declared a `Problem` schema with `properties` but no `type: object`, a 401 with
no `WWW-Authenticate` challenge, and cited the obsoleted RFC. All four are now fixed
upstream.

## License

Two licenses, by kind of thing:

- **Artifacts** — the schemas, rulesets, fixtures, examples and API descriptions — are
  **[CC BY-NC-SA 4.0](LICENSE)** (Attribution–NonCommercial–ShareAlike).
- **Code** — the validator, test harness and packaging — is **[Apache-2.0](LICENSE-CODE)**.

API Commons licenses **artifacts** under CC BY-NC-SA 4.0 and **code** under Apache-2.0.
