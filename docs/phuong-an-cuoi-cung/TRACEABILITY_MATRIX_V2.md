# TRACEABILITY MATRIX V2

| Slice | Requirement | Quyết định | Test bắt buộc |
|---|---|---|---|
| S1 Foundation | SRS §2, §9 | DEC-V2-001..005 | workspace build, config validation, health |
| S2 Auth/RBAC | FR-003, §7 | DEC-V2-AUTH-01 | login/revoke/idle/absolute/IDOR/export |
| S3 Catalog | FR-001 | DEC-V2-PROD-01 | SKU, versioned price, client spoof ignored |
| S4 Checkout/order | FR-002/004 | DEC-V2-ORD-01 | idempotency, state machine, version conflict |
| S5 Inventory | FR-006 | DEC-V2-INV-01/02 | FEFO/FIFO, expiry, final-unit concurrency, rollback |
| S6 Payment/finance | FR-008/010 | DEC-V2-FIN-01/02 | partial pay/refund/COD/cost/loss/rounding |
| S7 Return/payout | FR-008/010 | DEC-V2-FIN-01/02 | partial return, clawback, payout idempotency |
| S8 UI/ops | FR-011/013/014 | DEC-V2-004..007 | responsive UAT, audit, restore, monitoring |
