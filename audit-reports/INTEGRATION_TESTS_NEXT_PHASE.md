# Integration tests — giai đoạn tiếp theo (NOT RUN)

Không test nào dưới đây được chạy trên database thật của người dùng. Chỉ thực hiện khi có replica-set **test cô lập**, credentials riêng và xác nhận rõ database allowlist. Unit/mock và offline Mongoose casting hiện tại không chứng minh transaction/concurrency/durability.

## Database/transaction suite
1. Order last-unit confirm race: 2 orders cạnh tranh 1 unit, chỉ 1 reserve; stock/movements/allocations reconcile.
2. Confirm→ship retry cùng key, khác key, stale version; outbound đúng một lần; timeout sau commit replay response gốc.
3. Return RESTOCK/DISCARD full/partial; returnedQty/cogs/return credit theo historical batch; return→status laundering không tạo giao lại; shippedCancellationAt tồn tại sau save/read và qua các status trung gian.
4. Fault injection sau stock mutation trước ledger/audit/idempotency: mọi record rollback; replay sau uncertain commit không duplicate.
5. Exact purchase costing: nondivisible freight 1/2/many units, mixed/free lines, duplicate SKU; sum(receipt items freight)=shipping, sum(qty*cost)=total; partial allocation/outbound/restock bảo toàn vốn; CAS failure rollback mọi split batch.
6. Zero merchandise value + positive freight: reject trước bất kỳ batch/movement/receipt write; không chọn allocation policy khi chưa phê duyệt.
7. KPI new settlement: policy/tiers/window/roster snapshot (kể cả zero, inactive theo eligibility hiện tại), actual BSON cast/persist/read, không live recompute sau policy/member/order changes.
8. KPI simultaneous settle và idempotent replay: unique awards, bonus ledger/balance increment một lần; OPEN→SETTLED compare-and-set rollback loser; failure trong awards/snapshot/audit rollback toàn bộ.
9. Legacy settled snapshot missing: stable explicit error, không tự trả thưởng/chốt lại/backfill; empty roster và BSON-size/capacity boundaries.
10. KPI close boundary [start,end): event exactly start included, exactly end excluded; no createdAt proxy; no future/current settle. Overlap/stacking tests chờ policy.
11. Dashboard aggregate thực: KPI accrual trừ profit một lần, payout chỉ giảm cash, signed adjustment không double counting; Member không thấy owner finances.
12. Index deployment/readback: idempotency scope/key, award period/member, inventory/order version predicates; schema validators và unique conflicts thực.
13. Concurrency payout/refund/return/KPI settlement trên cùng balance; BUS07/09 expected assertions phải chờ policy finality/commission.

## Client/API integration riêng (không tuyên bố đã chạy)
- Lost-response after actual commit: exact original request/same key replay; edited payload/remount/reload không key mới trước resolution.
- Concurrent same operation/401 và pending success schedule không xóa fence; actor changes và pending journal isolation.
- Session storage corrupt/blocked/quota; no plaintext payload secrets/PII; browser multi-tab/device limitations phải được kiểm chứng hoặc thiết kế operation contract riêng.
- Cost preview→request→persisted bucket parity, returned batch traceability.
- Typed 409 policy/lifecycle/snapshot errors hiển thị đúng; end-exclusive period UI compatibility.

## Không tự chạy migration
Chỉ lập dry-run/backfill plan dựa authoritative evidence; không kết nối env thật, không provision, không rewrite financial ledger hoặc historical cost snapshots. Cần owner phê duyệt độc lập trước mọi data access/migration tương lai.
