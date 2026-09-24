# Dynamic promotional QR codes

## Goal

Allow Tu Punto administrators to create printed QR codes whose destination can be changed later without reprinting them. The first release supports internal Tu Punto pages and external HTTPS destinations, with no scan analytics.

## Scope and ownership

- `tu-punto-v2-back` owns QR records, validation, administrative APIs, QR image generation, and public destination resolution.
- `tu-punto-v2-front` provides the authenticated management page for `admin` and `superadmin` roles.
- `tp-catalog/client`, hosted at `https://www.tu-punto.com`, exposes the public `/q/:code` entry URL and delegates resolution to the backend.

## Public QR contract

Every generated image encodes an immutable public URL in this form:

`https://www.tu-punto.com/q/<code>`

`<code>` is a short, random, unique identifier created by the server. It is never editable or reused. When a visitor opens the public URL, the catalog route resolves it against the backend and immediately redirects to its current destination. This keeps the printed QR stable while allowing the destination to change.

The `www.tu-punto.com` domain is intentionally used instead of the management domain because it is the public, branded and long-lived URL users should scan.

## Data model

Each dynamic QR record contains:

- immutable public code;
- required internal name/label;
- required current destination URL;
- `active` state, defaulting to active;
- creator user reference and creation/update timestamps.

Records are deactivated rather than deleted. This prevents a printed code from later resolving to a different campaign due to ID reuse.

## Administration experience

Create a protected QR management page under the existing management application. It offers:

- paginated/searchable list showing name, public code/link, destination, state and creation date;
- filters for active and inactive records;
- create form with name, destination and active state;
- edit form for name, destination and active state, never the public code;
- one-click activation/deactivation;
- copy public URL;
- PNG download for printing.

All management endpoints and the page require the existing `admin` or `superadmin` authorization. The public resolver has no authentication requirement.

## Destination validation

External destinations must be valid absolute `https://` URLs. Internal destinations are accepted as a path and normalized to `https://www.tu-punto.com/<path>`. The server remains the source of truth and validates again regardless of frontend validation. Unsafe schemes and malformed URLs are rejected.

## Failure behavior

If a code is unknown, inactive, or has an invalid/unavailable configured destination, the public entry route does not redirect. It displays a concise public “link unavailable” page without exposing administrative details. Administrative API failures return the project-standard authenticated error responses.

## Testing

Automated coverage should verify code uniqueness, destination normalization and validation, role protection, create/list/edit/activate/deactivate flows, resolver redirects for external and internal targets, rejection/handling of inactive and unknown codes, and QR image generation containing the canonical public URL. Frontend checks cover form validation, state updates and access guard behavior.

## Explicitly out of scope

- scan counts, last-scan information, geographic/device data, or campaign analytics;
- seller-managed QR ownership;
- physical deletion or reuse of QR codes;
- non-HTTPS external destinations.
