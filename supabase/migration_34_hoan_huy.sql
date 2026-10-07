-- Trạng thái khách "tính là hoàn / huỷ": doanh số của khách ở trạng thái này chuyển sang cột Hoàn / huỷ
alter table customer_statuses add column if not exists la_hoan_huy boolean not null default false;

-- Tự đánh dấu trạng thái có tên bắt đầu bằng "Hoàn hu..." (Hoàn huỷ dịch vụ)
update customer_statuses set la_hoan_huy = true
where lower(ten) like 'hoàn hu%' or lower(ten) like 'hoan hu%' or ma like 'hoan_huy%';
