# โครงสร้างฐานข้อมูลแยกหมวดหมู่ (Modularized Database Schemas)

เอกสารและไฟล์ SQL นี้ถูกจัดระเบียบแยกตามหมวดหมู่เพื่อความง่ายในการดูแลรักษา (Maintainability) และรองรับการขยายตัวในอนาคต (Scalability)

---

## 📁 สารบัญหมวดหมู่ SQL (SQL Modules)

| ลำดับ | ชื่อไฟล์ | หมวดหมู่ | รายละเอียด |
| :---: | :--- | :--- | :--- |
| **01** | [`01_users_and_auth.sql`](./01_users_and_auth.sql) | **Users & Authentication** | ตารางบัญชีผู้ใช้ (`User`), รหัสผ่าน, Session Version, OTP, และ Verification codes |
| **02** | [`02_folders.sql`](./02_folders.sql) | **Folders & Hierarchy** | ตารางโฟลเดอร์ (`Folder`), Foreign Keys, การจัดเก็บแบบลูกซ้อนแม่ (Nested Hierarchy) |
| **03** | [`03_notes_and_sharing.sql`](./03_notes_and_sharing.sql) | **Notes & Sharing** | ตารางโน้ต (`Note`), เนื้อหา Markdown, สีธีม, Revision (OCC), และระบบ Public Share Token |
| **04** | [`04_indexes_and_search.sql`](./04_indexes_and_search.sql) | **Search & Performance** | การเปิดใช้ `pg_trgm` และสร้าง GIN Trigram Index เพื่อเร่งความเร็วการค้นหาโน้ต |
| **05** | [`05_functions_and_rpcs.sql`](./05_functions_and_rpcs.sql) | **Functions & Stored Procedures** | ฟังก์ชันระดับฐานข้อมูล (`update_nota_folder`, `delete_nota_account`, `delete_nota_empty_folder`) |
| **06** | [`06_security_and_rls.sql`](./06_security_and_rls.sql) | **Security & Access Control** | การเปิด Row Level Security (RLS) และจำกัดสิทธิ์เข้าถึงเฉพาะ Backend Service Role |

---

## 📌 วิธีจัดระเบียบใน Supabase Dashboard (SQL Editor)

คุณสามารถเปิด [Supabase SQL Editor](https://supabase.com/dashboard/project/nbdkkwomonxcrdwuvsaj/sql) แล้วสร้างแท็บแยกตาม 6 หมวดหมู่ข้างต้นได้ทันที:
1. แท็บเดิม `base` (`1db72437-74a8-478a-8bf6-362800e358ba`) สามารถเปลี่ยนชื่อหรือใช้เป็น **`01_Users`**
2. กดปุ่ม **New query (+)** เพื่อสร้างแท็บใหม่:
   - `02_Folders` (คัดลอกเนื้อหาจาก `02_folders.sql`)
   - `03_Notes` (คัดลอกเนื้อหาจาก `03_notes_and_sharing.sql`)
   - `04_Indexes_Search` (คัดลอกเนื้อหาจาก `04_indexes_and_search.sql`)
   - `05_Functions_RPC` (คัดลอกเนื้อหาจาก `05_functions_and_rpcs.sql`)
   - `06_Security_RLS` (คัดลอกเนื้อหาจาก `06_security_and_rls.sql`)
