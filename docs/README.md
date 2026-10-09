# DOCUMENTATION INDEX — CÁ BỐNG SÔNG TRÀ

> Baseline: 09/10/2026 · Gate: **READY FOR IMPLEMENTATION — P0a**

## Thứ tự đọc bắt buộc

1. `DOCS_DECISION_LOG.md` — quyết định nghiệp vụ canonical và các gate production.
2. `PROJECT_CONTEXT_CA_BONG_SONG_TRA_FULL.md` — bối cảnh kinh doanh và nguyên tắc.
3. `DATA_DICTIONARY.md` — schema, enum và state machine canonical.
4. `API_CONTRACTS.md` — input/output, error codes, authz/RLS và transaction boundary.
5. `TRACEABILITY_MATRIX.md` — scope P0a, acceptance IDs và readiness gates.
6. `KE_HOACH_FULLSTACK_CA_BONG_SONG_TRA_V1.md` — kiến trúc và lộ trình triển khai.
7. `THONG_TIN_SAN_PHAM_CA_BONG_SONG_TRA_WEBSITE.md` — nội dung public/mixed; không render phần 🔒.

## Thứ tự ưu tiên khi có mâu thuẫn

Decision Log → Data Dictionary/API Contracts → Project Context → Master Plan → Product Content → source/data mẫu cũ.

Không tự chọn một giá trị khi tài liệu mâu thuẫn. Mở `DEC-*`, cập nhật các artifact liên quan trong cùng pull request và thêm/đổi acceptance test.

## Ý nghĩa gate

- **Ready for implementation:** developer có thể bắt đầu P0a theo contract hiện tại.
- **Ready for staging UAT:** chỉ đạt sau khi migrations, RLS, RPC, tests và content audit được triển khai.
- **Ready for production:** chỉ đạt sau các bằng chứng nhãn, tồn đầu kỳ, Zalo, hosting, MFA, backup/restore và đối soát Excel.

Không được diễn giải “Ready for implementation” thành “đã sẵn sàng bán thật”.