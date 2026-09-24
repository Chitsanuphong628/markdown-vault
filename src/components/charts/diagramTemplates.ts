export interface DiagramTemplate {
  id: string;
  name: { en: string; th: string };
  category: "flowchart" | "sequence" | "chart" | "state" | "mindmap" | "erd";
  description: { en: string; th: string };
  badge: string;
  mermaidCode: string;
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    id: "auth-flow",
    name: {
      en: "User Authentication & Verification",
      th: "กระบวนการล็อกอินและตรวจสิทธิ์ (Auth Flow)",
    },
    category: "flowchart",
    badge: "Flowchart",
    description: {
      en: "Login flow with password validation and decision diamond branching.",
      th: "ผังการเข้าสู่ระบบพร้อมโหนดตัดสินใจตรวจสอบรหัสผ่านและสร้างเซสชัน",
    },
    mermaidCode: `flowchart TD
    Start(["เริ่มต้น (Start)"]) --> Input["ผู้ใช้กรอกอีเมลและรหัสผ่าน"]
    Input --> Validate{"ตรวจสอบข้อมูล\n(Credentials Check)"}
    Validate -- "ไม่ถูกต้อง (Invalid)" --> Alert["แสดงแจ้งเตือนข้อผิดพลาด"]
    Alert --> Input
    Validate -- "ถูกต้อง (Valid)" --> CreateToken[("สร้าง Session Token")]
    CreateToken --> Success(["เข้าสู่ระบบสำเร็จ (Success)"])`,
  },
  {
    id: "web-architecture",
    name: {
      en: "Modern Cloud Architecture",
      th: "สถาปัตยกรรมระบบเว็บคลาวด์ (Cloud Architecture)",
    },
    category: "flowchart",
    badge: "Architecture",
    description: {
      en: "High-level overview: Client, Edge CDN, Next.js API, Redis Cache, and PostgreSQL.",
      th: "ภาพรวมระบบ: ไคลเอนต์, CDN, API Server, Redis แคช และฐานข้อมูล Postgres",
    },
    mermaidCode: `flowchart LR
    Client["Client Browser"] --> CDN["Vercel Edge CDN"]
    CDN --> NextAPI["Next.js Serverless API"]
    NextAPI --> Redis[("Upstash Redis\\nSession Cache")]
    NextAPI --> Supabase[("Supabase PostgreSQL\\nDatabase")]`,
  },
  {
    id: "api-sequence",
    name: {
      en: "API Request & Response Lifecycle",
      th: "วงจรการเรียก API (Sequence Diagram)",
    },
    category: "sequence",
    badge: "Sequence",
    description: {
      en: "Step-by-step sequence diagram between User, Frontend, API, and DB.",
      th: "ลำดับการรับส่งข้อความระหว่างผู้ใช้, ส่วนหน้า, API และฐานข้อมูล",
    },
    mermaidCode: `sequenceDiagram
    autonumber
    actor User as ผู้ใช้งาน
    participant FE as หน้าเว็บ (React/Next.js)
    participant API as /api/notes
    participant DB as Supabase PostgreSQL

    User->>FE: คลิกเลือกโน้ต
    FE->>API: GET /api/notes/:id (Bearer Token)
    API->>DB: SELECT * FROM Note WHERE id = ...
    DB-->>API: 200 OK (Note Data + Revision)
    API-->>FE: JSON Response
    FE-->>User: แสดงผลโน้ตพร้อมสารบัญ`,
  },
  {
    id: "quarterly-metrics",
    name: {
      en: "Quarterly Performance Growth",
      th: "สถิติการเติบโตรายไตรมาส (Metrics Chart)",
    },
    category: "chart",
    badge: "Chart",
    description: {
      en: "Bar and line chart showing quarterly active users and targets.",
      th: "กราฟแท่งเปรียบเทียบยอดผู้ใช้งานรายไตรมาสพร้อมเส้นเป้าหมาย",
    },
    mermaidCode: `xychart-beta
    title "Quarterly User Growth (2026)"
    x-axis ["Q1", "Q2", "Q3", "Q4"]
    y-axis "Active Users (k)" 0 --> 120
    bar [35, 62, 88, 105]
    line [40, 60, 80, 100]`,
  },
  {
    id: "budget-pie",
    name: {
      en: "Resource & Budget Allocation",
      th: "สัดส่วนงบประมาณและทรัพยากร (Pie Chart)",
    },
    category: "chart",
    badge: "Pie",
    description: {
      en: "Pie chart displaying project resource breakdown.",
      th: "กราฟวงกลมแสดงสัดส่วนการจัดสรรทรัพยากรและงบประมาณ",
    },
    mermaidCode: `pie title Budget Allocation (2026)
    "Engineering & Dev" : 45
    "Infrastructure & Cloud" : 25
    "Design & UX" : 15
    "Security & Compliance" : 15`,
  },
  {
    id: "order-state-machine",
    name: {
      en: "Document / Task Lifecycle",
      th: "วงจรชีวิตเอกสารและงาน (State Machine)",
    },
    category: "state",
    badge: "State",
    description: {
      en: "State diagram mapping transitions from Draft to Published or Archived.",
      th: "แผนผังสถานะจากร่างเอกสาร สู่การตรวจทาน อนุมัติ และจัดเก็บ",
    },
    mermaidCode: `stateDiagram-v2
    [*] --> Draft: สร้างเอกสารใหม่
    Draft --> UnderReview: ส่งตรวจทาน
    UnderReview --> Draft: ขอแก้ไขเพิ่มเติม
    UnderReview --> Approved: อนุมัติเนื้อหา
    Approved --> Published: เผยแพร่สู่สาธารณะ
    Published --> Archived: สิ้นสุดอายุการใช้งาน
    Archived --> [*]`,
  },
  {
    id: "feature-mindmap",
    name: {
      en: "Product Brainstorm Map",
      th: "แผนผังระดมความคิดผลิตภัณฑ์ (Mindmap)",
    },
    category: "mindmap",
    badge: "Mindmap",
    description: {
      en: "Multi-level mindmap breaking down core capabilities and features.",
      th: "แผนผังความคิดแสดงแกนหลักของระบบและฟีเจอร์ย่อย",
    },
    mermaidCode: `mindmap
  root(("Nota Vault"))
    ["ความปลอดภัย (Security)"]
      ("Row Level Security")
      ("One-Time Passcode")
      ("Session Revocation")
    ["การจัดการข้อมูล (Data)"]
      ("Live Mermaid Charts")
      ("Multi-format Export")
      ("Real-time Search")
    ["ประสบการณ์ผู้ใช้ (UX)"]
      ("Voice Dictation")
      ("Rich Visual Editor")
      ("Note Theme Colors")`,
  },
  {
    id: "erd-model",
    name: {
      en: "Database Entity Relationship (ERD)",
      th: "แบบจำลองโครงสร้างฐานข้อมูล (ERD)",
    },
    category: "erd",
    badge: "ER Diagram",
    description: {
      en: "Relational data model between User, Folder, and Note entities.",
      th: "ผังความสัมพันธ์ระหว่างตาราง User, Folder และ Note",
    },
    mermaidCode: `erDiagram
    USER ||--o{ FOLDER : owns
    USER ||--o{ NOTE : creates
    FOLDER ||--o{ NOTE : contains
    FOLDER ||--o{ FOLDER : parent_of

    USER {
        string id PK
        string email UK
        string name
        int sessionVersion
    }
    FOLDER {
        string id PK
        string name
        string userId FK
        string parentId FK
    }
    NOTE {
        string id PK
        string title
        string content
        int revision
        string userId FK
        string folderId FK
    }`,
  },
];
