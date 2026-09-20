---
title: "คู่มือสเปกระบบและมาตรฐานไฟล์ Markdown (Contract)"
category: "Architecture"
tags: ["spec", "guide", "contract"]
date: "2026-09-20"
---

# คู่มือและมาตรฐานโครงสร้างไฟล์ Markdown (Note Contract)

ไฟล์นี้เป็นตัวอย่าง **Contract รูปแบบไฟล์ Markdown** ที่ระบบ Markdown Vault รองรับอย่างเต็มรูปแบบ พร้อมสาธิตการวาดกราฟและไดอะแกรมด้วย Mermaid

---

## 1. การวาดกราฟและ Flowchart ในไฟล์ .md

คุณสามารถใส่บล็อกโค้ด \`\`\`mermaid แล้ววาดกราฟ Flowchart, Sequence, State หรือ Mindmap ได้ทันที:

```mermaid
graph TD
    A["📁 โยนไฟล์ .md เข้าสู่ระบบ"] --> B{"ตรวจสอบความถูกต้อง"}
    B -->|ไฟล์ปกติทั่วไป| C["📝 บันทึกและวิเคราะห์หัวข้อ TOC"]
    B -->|มี Frontmatter Header| D["🏷️ สกัด Tags & Category"]
    C --> E["🚀 เรนเดอร์ UI สวยงาม + Interactive Graph"]
    D --> E
    E --> F["🔍 ค้นหาแบบ Full-text Search ได้ทันที"]
```

---

## 2. ตัวอย่าง Sequence Diagram (การทำงานของระบบ)

```mermaid
sequenceDiagram
    autonumber
    actor User as ผู้ใช้งาน
    participant Web as Web Reader
    participant Parser as Markdown & Mermaid Parser
    participant DB as SQLite Database

    User->>Web: ลากไฟล์ .md โยนลงหน้าเว็บ
    Web->>DB: บันทึกเนื้อหาและจัดเข้า Folder
    DB-->>Web: บันทึกสำเร็จ
    Web->>Parser: Parse หัวข้อ, Code block, ไดอะแกรม
    Parser-->>Web: แปลงเป็นกราฟ SVG และสารบัญ TOC
    Web-->>User: แสดงผลหน้าอ่านสวยงาม สบายตา
```

---

## 3. ตัวอย่าง Class Diagram (Contract สถาปัตยกรรมข้อมูล)

```mermaid
classDiagram
    class User {
        +String id
        +String email
        +String name
        +createNote()
        +createFolder()
    }
    class Folder {
        +String id
        +String name
        +String parentId
        +Folder parent
        +Folder[] children
    }
    class Note {
        +String id
        +String title
        +String content
        +String folderId
        +DateTime updatedAt
        +renderMermaid()
        +generateTOC()
    }

    User "1" --> "*" Folder : owns
    User "1" --> "*" Note : owns
    Folder "1" --> "*" Note : contains
    Folder "1" --> "*" Folder : subfolders
```

---

## 4. มาตรฐาน Contract กลางสำหรับไฟล์ Markdown ที่แนะนำ

ระบบของเรารองรับไฟล์ `.md` ทั่วไปได้ทุกแบบ **(100% Flexible)** แต่หากต้องการให้จัดโครงสร้างได้สมบูรณ์แบบ แนะนำให้มีโครงสร้างดังนี้:

### โครงสร้างที่แนะนำ:
1. **Frontmatter (ถ้ามี)**: ใช้ \`---\` ปิดหัวท้าย เพื่อระบุ Metadata เช่น \`title\`, \`category\`, \`tags\`
2. **Heading 1 (\`# หัวข้อหลัก\`)**: เป็นชื่อเรื่องของเอกสาร
3. **Heading 2 & 3 (\`##\`, \`###\`)**: ใช้แบ่งหัวข้อย่อย ซึ่งระบบจะดึงไปทำ **สารบัญ (TOC)** ด้านขวามือให้เองอัตโนมัติ
4. **Mermaid Block**: เขียนโค้ดกราฟในบล็อก \`\`\`mermaid ระบบจะวาดเป็นกราฟ Interactive ให้ทันที
5. **Code Blocks**: ระบุชื่อภาษา เช่น \`\`\`typescript หรือ \`\`\`python เพื่อไฮไลต์สีโค้ด
