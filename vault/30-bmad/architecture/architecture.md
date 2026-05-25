# "Є турбота" — Технічна архітектура

> Care Coordination Platform | Angular 19 + NestJS + PostgreSQL + Socket.io + Prisma

---

## 1. Огляд системи

### Архітектурне рішення: Модульний моноліт

**Рішення:** Модульний моноліт для MVP з чіткими межами модулів.

**Чому не мікросервіси:**

| Критерій | Модульний моноліт | Мікросервіси |
|---|---|---|
| Команда | 2-3 розробники | 5+ розробників |
| Deployment | 1 артефакт, просто | Kubernetes, складна оркестрація |
| Транзакції | Локальні транзакції | Saga, eventual consistency |
| Debugging | Stack trace | Distributed tracing |
| MVP швидкість | 6-8 тижнів | 4-6 місяців |
| Еволюція | Можна розбити пізніше | Важко об'єднати назад |

**Архітектурний принцип:** кожний NestJS-модуль — це потенційний мікросервіс. Спілкування між модулями — через інтерфейси (не прямі виклики repository інших модулів). Коли з'явиться потреба — виріжемо модуль в окрему службу.

### Загальна архітектура

```
                                 CLIENTS
    +------------------+------------------+------------------+
    |   Angular SPA    |  Telegram Bot    | Instagram/FB/    |
    |   (Browser)      |  (Webhook)       | Viber (Webhook)  |
    +--------+---------+--------+---------+--------+---------+
             |                  |                  |
             |     HTTPS/WSS   |    HTTPS          |  HTTPS
             |                 |                   |
    +--------v---------+-------v---------+---------v---------+
    |                                                         |
    |                    NGINX / Reverse Proxy                |
    |                    (SSL termination, rate limiting)      |
    +---------------------------+-----------------------------+
                                |
    +---------------------------v-----------------------------+
    |                                                         |
    |                  NestJS Application                      |
    |                  (Modular Monolith)                      |
    |                                                         |
    |  +----------+ +----------+ +----------+ +----------+   |
    |  |   Auth   | |  Users   | |  Cases   | |   Chat   |   |
    |  |  Module  | |  Module  | |  Module  | |  Module  |   |
    |  +----------+ +----------+ +----------+ +----------+   |
    |  +----------+ +----------+ +----------+ +----------+   |
    |  | Courses  | | Meetings | |  Notif   | | Channels |   |
    |  |  Module  | |  Module  | |  Module  | |  Module  |   |
    |  +----------+ +----------+ +----------+ +----------+   |
    |  +----------+ +----------+ +----------+ +----------+   |
    |  | Assign   | |   SLA    | |  Crisis  | | Analytics|   |
    |  |  Module  | |  Module  | |  Module  | |  Module  |   |
    |  +----------+ +----------+ +----------+ +----------+   |
    |                                                         |
    |  +----------------------------------------------------+ |
    |  |              Prisma ORM + PostgreSQL                | |
    |  +----------------------------------------------------+ |
    |                                                         |
    +---+-----------+-----------+-------------+---------------+
        |           |           |             |
   +----v---+  +----v---+  +---v----+  +-----v-----+
   |  PG    |  |  Redis |  |  S3/R2 |  | Zoom/Meet |
   | (data) |  | (cache,|  | (files)|  |   (video)  |
   |        |  |  queue)|  |        |  |            |
   +--------+  +--------+  +--------+  +-----------+
```

### Потоки даних

```
  Person                   System                    Consultant
    |                         |                           |
    |-- Fill intake form ---->|                           |
    |                         |-- Create Care Case ----> |
    |                         |-- Auto-assignment ------->|
    |                         |-- Notification ---------->|
    |                         |                           |
    |<-- First response ----------------------------------|
    |                         |                           |
    |--- Message ------------>|--- Socket.io/Channel ---->|
    |<--- Reply --------------|<--- Socket.io ------------|
    |                         |                           |
    |                         |-- SLA monitoring -------->|
    |                         |-- Crisis detection ------>|
```

---

## 2. Схема бази даних (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// ENUMS
// ============================================================

enum UserRole {
  person
  consultant
  supervisor
  coordinator
  admin
}

enum CaseStatus {
  new
  assigned
  in_progress
  meeting_scheduled
  on_hold
  transferred
  completed
  closed
}

enum CasePriority {
  low
  medium
  high
  crisis // використовується handleCrisis для кризових кейсів
}

enum MeetingPlatform {
  zoom
  google_meet
}

enum SlaLevel {
  warning_4h
  warning_12h
  breach_24h
  critical_48h
  crisis_15m
  crisis_1h
  inactive_48h   // окремий рівень для неактивності переписки 48 год (нагадування консультанту)
  inactive_5d    // окремий рівень для неактивності переписки 5 днів (сповіщення координатору)
}

enum CaseSource {
  website_form
  course
  telegram
  instagram
  facebook
  viber
  referral
  manual
}

enum MessageChannel {
  web
  telegram
  instagram
  facebook
  viber
}

enum MeetingStatus {
  scheduled
  in_progress
  completed
  cancelled
  no_show
}

enum NotificationType {
  case_assigned
  new_message
  meeting_reminder
  sla_warning
  sla_breach
  crisis_alert
  case_transferred
  system
}

enum TransferReason {
  specialization_mismatch
  consultant_unavailable
  consultant_vacation
  consultant_left
  person_request
  supervisor_decision
  workload_balance
}

enum CrisisLevel {
  none
  low
  medium
  high
  critical
}

enum ConsultantStatus {
  active
  on_vacation
  training
  inactive
}

enum LessonType {
  video
  text
  audio
  quiz
}

// ============================================================
// USERS & PROFILES
// ============================================================

model User {
  id            String    @id @default(uuid()) @db.Uuid
  email         String?   @unique
  phone         String?   @unique
  passwordHash  String?   @map("password_hash") // тільки для staff (Consultant, Coordinator, Admin)
  role          UserRole  @default(person)
  firstName     String    @map("first_name")
  lastName      String?   @map("last_name")
  avatarUrl     String?   @map("avatar_url")
  isActive      Boolean   @default(true) @map("is_active")
  lastLoginAt   DateTime? @map("last_login_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  person     Person?
  consultant Consultant?

  sentMessages     Message[]        @relation("MessageSender")
  authoredNotes    Note[]           @relation("NoteAuthor") // finding #6
  notifications    Notification[]
  refreshTokens    RefreshToken[]
  authProviders    AuthProvider[]

  @@index([role])
  @@index([email])
  // CHECK: хоча б один з email/phone NOT NULL (міграція: ALTER TABLE users ADD CONSTRAINT chk_user_contact CHECK (email IS NOT NULL OR phone IS NOT NULL))
  // CHECK: passwordHash NOT NULL для staff ролей (міграція: ALTER TABLE users ADD CONSTRAINT chk_staff_password CHECK (role = 'person' OR password_hash IS NOT NULL))
  // EDGE CASE #1: Два користувачі реєструються одночасно з однаковим phone → handle Prisma P2002 unique violation, повернути 409 Conflict у service layer
  @@map("users")
}

// --- Соціальна автентифікація ---

enum AuthProviderType {
  google
  facebook
  telegram
}

model AuthProvider {
  id           String           @id @default(uuid()) @db.Uuid
  userId       String           @map("user_id") @db.Uuid
  provider     AuthProviderType
  providerId   String           @map("provider_id") // Google sub, Facebook userId, Telegram userId
  accessToken  String?          @map("access_token") // AES-256-GCM encrypted at application layer (EncryptionService.encrypt/decrypt), NOT plaintext
  displayName  String?          @map("display_name")
  avatarUrl    String?          @map("avatar_url")
  createdAt    DateTime         @default(now()) @map("created_at")
  updatedAt    DateTime         @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerId]) // один Facebook-акаунт = один User
  @@index([userId])
  @@map("auth_providers")
}


model RefreshToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  token     String   @unique
  family    String   @db.Uuid // token family для replay attack detection (finding #22)
  isRevoked Boolean  @default(false) @map("is_revoked") // при replay — revoke all tokens в family
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@index([family])
  @@map("refresh_tokens")
  // Scheduled job: DELETE FROM refresh_tokens WHERE expires_at < now() (finding #21)
}

model Person {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @unique @map("user_id") @db.Uuid
  country          String?
  city             String?
  language         String   @default("uk") // uk, ru, en
  timezone         String?
  concerns         String[] // теми звернення; validation: max 10 items, values з whitelist ConcernTopic
  urgency          String?
  dataConsentAt             DateTime? @map("data_consent_at")        // згода на обробку персональних даних
  dataSensitiveConsentAt    DateTime? @map("data_sensitive_consent_at") // згода на обробку чутливих даних (Art.9 GDPR)
  preferredChannel MessageChannel? @map("preferred_channel") // finding #38: preferred reply channel
  telegramChatId   String?   @unique @map("telegram_chat_id")
  instagramId      String?   @unique @map("instagram_id")
  facebookId       String?   @unique @map("facebook_id")
  viberChatId      String?   @unique @map("viber_chat_id")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  careCases   CareCase[]
  enrollments Enrollment[]

  @@index([telegramChatId])
  @@index([language])
  @@map("persons")
}

model Consultant {
  id              String           @id @default(uuid()) @db.Uuid
  userId          String           @unique @map("user_id") @db.Uuid
  specializations String[]         // ["anxiety", "grief", "faith", "family"]
  languages       String[]         // ["uk", "en", "de"]
  maxCases        Int              @default(10) @map("max_cases")
  maxCrisisCases  Int              @default(3) @map("max_crisis_cases")
  status          ConsultantStatus @default(active)
  bio             String?
  mentorId        String?          @map("mentor_id") @db.Uuid
  onboardingWeek  Int?             @map("onboarding_week")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  mentor         Consultant?      @relation("MentorMentee", fields: [mentorId], references: [id])
  mentees        Consultant[]     @relation("MentorMentee")
  careCases      CareCase[]       @relation("AssignedConsultant")
  availability   Availability[]
  qualityMetrics QualityMetric[]
  transfersFrom  CaseTransfer[]   @relation("TransferFrom")
  transfersTo    CaseTransfer[]   @relation("TransferTo")

  @@index([status])
  @@index([specializations], type: Gin)
  @@index([languages], type: Gin)
  @@map("consultants")
}

model Availability {
  id           String   @id @default(uuid()) @db.Uuid
  consultantId String   @map("consultant_id") @db.Uuid
  dayOfWeek    Int      @map("day_of_week") // 0=Sunday, 6=Saturday
  startTime    String   @map("start_time") // "09:00"
  endTime      String   @map("end_time")   // "18:00"
  timezone     String   @default("Europe/Kyiv")

  consultant Consultant @relation(fields: [consultantId], references: [id], onDelete: Cascade)

  @@unique([consultantId, dayOfWeek, startTime])
  // CHECK: dayOfWeek >= 0 AND dayOfWeek <= 6 (finding #5)
  // EDGE CASE #12: Нічні зміни 22:00-06:00 не проходять CHECK startTime < endTime → Дозволити overnight зміни: прибрати CHECK або розбити на два інтервали (22:00-23:59 + 00:00-06:00). Service layer: якщо startTime > endTime, трактувати як overnight shift
  @@map("availability")
}

// ============================================================
// CARE CASES
// ============================================================

model CareCase {
  id              String       @id @default(uuid()) @db.Uuid
  personId        String       @map("person_id") @db.Uuid
  consultantId    String?      @map("consultant_id") @db.Uuid
  status          CaseStatus   @default(new)
  priority        CasePriority @default(medium)
  crisisLevel     CrisisLevel  @default(none)
  source          CaseSource   @default(website_form)
  topic           String       // NOT NULL — потрібен для авторозподілу (finding #3)
  description     String?
  sourceCourseId  String?      @map("source_course_id") @db.Uuid
  sourceLessonId  String?      @map("source_lesson_id") @db.Uuid
  firstResponseAt DateTime?    @map("first_response_at")
  resolvedAt      DateTime?    @map("resolved_at")
  closedAt        DateTime?    @map("closed_at")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  person       Person         @relation(fields: [personId], references: [id], onDelete: Restrict) // finding #16: не дозволяти видалення Person з активними кейсами
  consultant   Consultant?    @relation("AssignedConsultant", fields: [consultantId], references: [id])
  sourceCourse Course?        @relation(fields: [sourceCourseId], references: [id], onDelete: SetNull) // finding #15: при видаленні курсу — SetNull
  messages     Message[]
  notes        Note[]
  meetings     Meeting[]
  transfers    CaseTransfer[]
  slaEvents    SlaEvent[]

  @@index([status])
  @@index([consultantId])
  @@index([personId])
  @@index([priority])
  @@index([crisisLevel])
  @@index([createdAt])
  // EDGE CASE #15: Невалідний перехід статусу (напр. closed→in_progress) через PATCH → Додати state machine validation map у CasesService:
  // ALLOWED_TRANSITIONS: { new: [assigned], assigned: [in_progress, transferred], in_progress: [meeting_scheduled, on_hold, completed, transferred],
  //   meeting_scheduled: [in_progress, on_hold, completed], on_hold: [in_progress, closed], transferred: [assigned], completed: [closed], closed: [] }
  // Перевіряти перед кожним update: if (!ALLOWED_TRANSITIONS[currentStatus].includes(newStatus)) throw BadRequestException
  // EDGE CASE #3: Два повідомлення одночасно створюють два активні CareCase для однієї Person → Partial unique index:
  // CREATE UNIQUE INDEX uq_person_active_case ON care_cases(person_id) WHERE status NOT IN ('completed', 'closed')
  @@index([status, consultantId])
  @@map("care_cases")
}

// ============================================================
// MESSAGES
// ============================================================

model Message {
  id            String         @id @default(uuid()) @db.Uuid
  careCaseId    String         @map("care_case_id") @db.Uuid
  senderId      String         @map("sender_id") @db.Uuid
  senderRole    UserRole       @map("sender_role")
  channel       MessageChannel @default(web)
  channelChatId String?        @map("channel_chat_id")
  channelMsgId  String?        @map("channel_msg_id")
  content       String?        @db.VarChar(10000) // finding #18: nullable для attachment-only messages; finding #19: maxLength 10000
  // EDGE CASE: XSS через HTML/script теги у content → Санітизувати через DOMPurify (isomorphic-dompurify) перед persist в БД та перед Socket.io broadcast.
  // MessageService.create(): content = DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }) — strip ALL HTML.
  // Це запобігає stored XSS при відображенні повідомлень у web-інтерфейсі.
  attachments   Json?          // [{url, type, name, size}]; validation: JSON schema в service layer (finding #20)
  // Validation rule: content != null OR attachments != null (finding #18)
  isRead        Boolean        @default(false) @map("is_read")
  isEdited      Boolean        @default(false) @map("is_edited") // finding #14: audit trail для message edits
  readAt        DateTime?      @map("read_at")
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at") // finding #14: timestamp редагування

  careCase CareCase @relation(fields: [careCaseId], references: [id], onDelete: Cascade)
  sender   User     @relation("MessageSender", fields: [senderId], references: [id])

  @@index([careCaseId, createdAt])
  @@index([senderId])
  @@index([channel, channelChatId])
  @@index([careCaseId, isRead])
  @@map("messages")
}

// ============================================================
// NOTES (приватні нотатки консультанта)
// ============================================================

model Note {
  id         String   @id @default(uuid()) @db.Uuid
  careCaseId String   @map("care_case_id") @db.Uuid
  authorId   String   @map("author_id") @db.Uuid
  content    String
  isSupervisorNote Boolean @default(false) @map("is_supervisor_note")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  careCase CareCase @relation(fields: [careCaseId], references: [id], onDelete: Cascade)
  author   User     @relation("NoteAuthor", fields: [authorId], references: [id], onDelete: Restrict) // finding #6: FK relation до User

  @@index([careCaseId, createdAt])
  @@index([authorId])
  @@map("notes")
}

// ============================================================
// COURSES & LESSONS
// ============================================================

model Course {
  id          String   @id @default(uuid()) @db.Uuid
  title       String
  description String?
  coverUrl    String?  @map("cover_url")
  isPublished Boolean  @default(false) @map("is_published")
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  lessons     Lesson[]
  enrollments Enrollment[]
  careCases   CareCase[]

  @@map("courses")
}

model Lesson {
  id          String     @id @default(uuid()) @db.Uuid
  courseId     String     @map("course_id") @db.Uuid
  title       String
  content     String?
  videoUrl    String?    @map("video_url")
  type        LessonType @default(text)
  sortOrder   Int        @default(0) @map("sort_order")
  durationMin Int?       @map("duration_min")
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  course   Course           @relation(fields: [courseId], references: [id], onDelete: Cascade)
  progress LessonProgress[]

  @@index([courseId, sortOrder])
  @@map("lessons")
}

model Enrollment {
  id         String    @id @default(uuid()) @db.Uuid
  personId   String    @map("person_id") @db.Uuid
  courseId    String    @map("course_id") @db.Uuid
  startedAt  DateTime  @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")

  person   Person           @relation(fields: [personId], references: [id], onDelete: Cascade)
  course   Course           @relation(fields: [courseId], references: [id], onDelete: Cascade)
  progress LessonProgress[]

  @@unique([personId, courseId]) // finding #17: handle P2002 unique violation → 409 Conflict у service layer
  @@map("enrollments")
}

model LessonProgress {
  id           String    @id @default(uuid()) @db.Uuid
  enrollmentId String    @map("enrollment_id") @db.Uuid
  lessonId     String    @map("lesson_id") @db.Uuid
  startedAt    DateTime  @default(now()) @map("started_at")
  completedAt  DateTime? @map("completed_at")
  question     String?   // питання людини на уроці

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  lesson     Lesson     @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([enrollmentId, lessonId])
  @@map("lesson_progress")
}

// ============================================================
// MEETINGS
// ============================================================

model Meeting {
  id            String        @id @default(uuid()) @db.Uuid
  careCaseId    String        @map("care_case_id") @db.Uuid
  scheduledAt   DateTime      @map("scheduled_at")
  durationMin   Int           @default(60) @map("duration_min")
  meetingUrl    String?       @map("meeting_url")
  platform      MeetingPlatform? // finding #11: enum замість free-form String
  status        MeetingStatus @default(scheduled)
  notes         String?
  reminder1hSent  Boolean     @default(false) @map("reminder_1h_sent")
  reminder15mSent Boolean     @default(false) @map("reminder_15m_sent")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  // EDGE CASE #19: Немає consultantId FK — дорогі JOIN через CareCase → Додати пряме поле:
  // consultantId String? @map("consultant_id") @db.Uuid
  // consultant   Consultant? @relation(fields: [consultantId], references: [id])
  // Або задокументувати join path: Meeting → CareCase.consultantId → Consultant
  careCase CareCase @relation(fields: [careCaseId], references: [id], onDelete: Cascade)

  @@index([careCaseId])
  @@index([scheduledAt])
  @@index([status, scheduledAt])
  // Validation: scheduledAt > now() при створенні (finding #7)
  // Validation: перевірка overlap з існуючими meetings того ж consultant
  @@map("meetings")
}

// ============================================================
// NOTIFICATIONS
// ============================================================

model Notification {
  id        String           @id @default(uuid()) @db.Uuid
  userId    String           @map("user_id") @db.Uuid
  type      NotificationType
  title     String
  body      String?
  data      Json?            // {careCaseId, meetingId, ...}
  isRead    Boolean          @default(false) @map("is_read")
  readAt    DateTime?        @map("read_at")
  createdAt DateTime         @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([userId, createdAt])
  @@map("notifications")
}

// ============================================================
// CASE TRANSFERS
// ============================================================

model CaseTransfer {
  id               String         @id @default(uuid()) @db.Uuid
  careCaseId       String         @map("care_case_id") @db.Uuid
  fromConsultantId String         @map("from_consultant_id") @db.Uuid
  toConsultantId   String         @map("to_consultant_id") @db.Uuid
  reason           TransferReason
  notes            String?
  initiatedBy      String         @map("initiated_by") @db.Uuid // userId
  createdAt        DateTime       @default(now()) @map("created_at")

  careCase       CareCase   @relation(fields: [careCaseId], references: [id])
  fromConsultant Consultant @relation("TransferFrom", fields: [fromConsultantId], references: [id])
  toConsultant   Consultant @relation("TransferTo", fields: [toConsultantId], references: [id])

  @@index([careCaseId])
  @@index([fromConsultantId])
  @@index([toConsultantId])
  // CHECK: from_consultant_id != to_consultant_id (finding #8: заборона self-transfer)
  @@map("case_transfers")
}

// ============================================================
// SLA EVENTS
// ============================================================

model SlaEvent {
  id         String   @id @default(uuid()) @db.Uuid
  careCaseId String   @map("care_case_id") @db.Uuid
  level      SlaLevel // finding #12: enum замість free-form String
  message    String
  notifiedAt DateTime @default(now()) @map("notified_at")

  careCase CareCase @relation(fields: [careCaseId], references: [id], onDelete: Cascade)

  @@unique([careCaseId, level]) // finding #33: запобігання дублікатів SLA notifications
  @@index([careCaseId])
  @@map("sla_events")
}

// ============================================================
// QUALITY METRICS
// ============================================================

model QualityMetric {
  id              String   @id @default(uuid()) @db.Uuid
  consultantId    String   @map("consultant_id") @db.Uuid
  periodStart     DateTime @map("period_start")
  periodEnd       DateTime @map("period_end")
  avgResponseTime Int?     @map("avg_response_time") // у хвилинах
  casesCompleted  Int      @default(0) @map("cases_completed")
  casesActive     Int      @default(0) @map("cases_active")
  casesStaleDays  Int      @default(0) @map("cases_stale_days")
  feedbackScore   Float?   @map("feedback_score")
  crisisCases     Int      @default(0) @map("crisis_cases")
  createdAt       DateTime @default(now()) @map("created_at")

  consultant Consultant @relation(fields: [consultantId], references: [id], onDelete: Cascade)

  @@unique([consultantId, periodStart])
  @@index([consultantId])
  @@map("quality_metrics")
}
```

### ER-діаграма (спрощена)

```
  +--------+     +----------+     +------------+
  | Users  |---->| Persons  |---->| Care Cases |
  +--------+     +----------+     +-----+------+
      |                                 |
      v                                 |
  +-----------+                         |
  |Consultants|<------------------------+
  +-----------+        |          |           |
      |          +-----v---+ +---v----+ +----v-----+
      |          |Messages | | Notes  | | Meetings |
      v          +---------+ +--------+ +----------+
  +----------+
  |Availability|      +----------+     +--------+
  +----------+        | Courses  |---->| Lessons|
                      +-----+----+     +---+----+
                            |              |
                      +-----v------+  +----v-----------+
                      |Enrollments |->|LessonProgress  |
                      +------------+  +----------------+
```

---

## 3. API архітектура

### Конвенції

- Базовий URL: `/api/v1`
- Формат: JSON
- Автентифікація: Bearer JWT token
- Пагінація: `?page=1&limit=20`
- Сортування: `?sort=createdAt&order=desc`
- Фільтрація: `?status=new&priority=high`
- Відповідь: `{ data, meta: { total, page, limit } }`
- Помилки: `{ statusCode, message, error }`
- CORS: whitelist origins, reject запити без `Origin` header (секція 13.5)
- Helmet: строгий CSP (секція 13.5)
- Health check: `GET /health` — мінімальний response `{ status: 'ok' }` (секція 13.7)

### Ендпоінти по модулях

#### AuthModule

```
// --- Person (social login) ---
GET    /api/v1/auth/google             -- redirect на Google OAuth
GET    /api/v1/auth/google/callback    -- Google callback → JWT
GET    /api/v1/auth/facebook           -- redirect на Facebook OAuth
GET    /api/v1/auth/facebook/callback  -- Facebook callback → JWT
POST   /api/v1/auth/telegram           -- Telegram Login Widget payload → JWT

// --- Staff (email + password) ---
POST   /api/v1/auth/login             -- вхід для staff (email + password)
POST   /api/v1/auth/forgot-password   -- запит на відновлення паролю (staff)
POST   /api/v1/auth/reset-password    -- встановлення нового паролю (staff)

// --- Спільні ---
POST   /api/v1/auth/refresh           -- оновлення токена
POST   /api/v1/auth/logout            -- вихід
GET    /api/v1/auth/me                -- поточний користувач
POST   /api/v1/auth/link-provider     -- прив'язати додатковий провайдер до існуючого акаунту
// EDGE CASE #14: Провайдер вже прив'язаний до іншого акаунту → Catch P2002 unique violation на @@unique([provider, providerId]), повернути 409 Conflict з інструкціями для merge акаунтів
DELETE /api/v1/auth/unlink-provider/:provider -- відв'язати провайдер
// EDGE CASE: Person відв'язує єдиний auth provider → Перевірити, що залишається хоча б один інший метод автентифікації
// (passwordHash != null АБО інші AuthProvider записи). Якщо це останній метод — повернути 409 Conflict з повідомленням
// "Неможливо відв'язати останній метод автентифікації. Спочатку додайте інший провайдер або встановіть пароль."
```

#### UsersModule

```
GET    /api/v1/users                  -- список користувачів (admin)
GET    /api/v1/users/:id              -- профіль
PATCH  /api/v1/users/:id              -- оновлення профілю
DELETE /api/v1/users/:id              -- деактивація (soft delete)
// EDGE CASE #11: Адмін деактивує консультанта з активними кризовими кейсами → Перед деактивацією перевірити наявність active crisis cases (crisisLevel >= high). Якщо є — блокувати з 409 або force-transfer всіх активних кейсів через AssignmentService.transferCase() перед деактивацією

GET    /api/v1/persons/:id            -- розширений профіль людини
PATCH  /api/v1/persons/:id            -- оновлення

GET    /api/v1/consultants            -- список консультантів
GET    /api/v1/consultants/:id        -- профіль консультанта
PATCH  /api/v1/consultants/:id        -- оновлення
GET    /api/v1/consultants/:id/workload    -- навантаження
GET    /api/v1/consultants/:id/availability -- розклад
PUT    /api/v1/consultants/:id/availability -- оновлення розкладу
POST   /api/v1/consultants/:id/vacation    -- відпустка
```

#### CasesModule

```
POST   /api/v1/cases                  -- створити кейс (анкета); validation: Person.dataConsentAt NOT NULL (finding #28)
GET    /api/v1/cases                  -- список кейсів (з фільтрами)
GET    /api/v1/cases/:id              -- деталі кейсу
PATCH  /api/v1/cases/:id              -- оновлення статусу
POST   /api/v1/cases/:id/assign       -- призначити консультанта
POST   /api/v1/cases/:id/transfer     -- передати кейс
POST   /api/v1/cases/:id/close        -- закрити кейс
// EDGE CASE #18: Людина не сповіщена про закриття кейсу → Після зміни статусу на closed, надіслати повідомлення Person через ChannelRouter.sendOutgoing() на preferredChannel або останній активний канал

GET    /api/v1/cases/:id/notes        -- нотатки до кейсу
POST   /api/v1/cases/:id/notes        -- додати нотатку
PATCH  /api/v1/cases/:id/notes/:noteId -- редагувати нотатку
// EDGE CASE #22: Консультант може редагувати чужу нотатку → В NotesService.update() перевіряти note.authorId === currentUser.id перед оновленням, інакше 403 Forbidden
DELETE /api/v1/cases/:id/notes/:noteId -- видалити нотатку
```

#### ChatModule

```
GET    /api/v1/cases/:id/messages          -- історія повідомлень
POST   /api/v1/cases/:id/messages          -- надіслати повідомлення (REST fallback)
POST   /api/v1/cases/:id/messages/read     -- позначити прочитаним
GET    /api/v1/cases/:id/messages/unread   -- кількість непрочитаних
```

#### CoursesModule

```
// --- Публічні (без авторизації) ---
GET    /api/v1/courses                     -- каталог курсів (публічний)
GET    /api/v1/courses/:id                 -- превью курсу: опис, список уроків, трейлер (публічний)

// --- Авторизовані (Person або Staff) ---
POST   /api/v1/courses                     -- створити курс (admin)
PATCH  /api/v1/courses/:id                 -- оновити курс
DELETE /api/v1/courses/:id                 -- видалити курс

GET    /api/v1/courses/:id/lessons         -- уроки курсу (авторизований)
GET    /api/v1/courses/:id/lessons/:lessonId -- контент уроку (авторизований)
POST   /api/v1/courses/:id/lessons         -- додати урок
PATCH  /api/v1/courses/:courseId/lessons/:lessonId -- оновити урок
DELETE /api/v1/courses/:courseId/lessons/:lessonId -- видалити урок

POST   /api/v1/courses/:id/enroll          -- записатися на курс
GET    /api/v1/enrollments/my              -- мої курси
POST   /api/v1/enrollments/:id/progress    -- оновити прогрес
GET    /api/v1/enrollments/:id/progress    -- подивитися прогрес
```

#### MeetingsModule

```
POST   /api/v1/cases/:id/meetings          -- запланувати зустріч
GET    /api/v1/cases/:id/meetings          -- зустрічі кейсу
PATCH  /api/v1/meetings/:id               -- оновити зустріч
DELETE /api/v1/meetings/:id               -- скасувати
GET    /api/v1/meetings/upcoming           -- майбутні зустрічі (поточного юзера)
```

#### NotificationsModule

```
GET    /api/v1/notifications               -- мої сповіщення; finding #42: pagination ?page, ?limit (default 20)
PATCH  /api/v1/notifications/:id/read      -- прочитати
POST   /api/v1/notifications/read-all      -- прочитати всі; finding #40: WHERE userId = @currentUser.id (scope by authenticated user)
GET    /api/v1/notifications/unread-count  -- кількість непрочитаних
```

#### AssignmentModule

```
POST   /api/v1/assignment/auto             -- автопризначення
GET    /api/v1/assignment/suggest/:caseId  -- запропонувати консультанта
```

#### AnalyticsModule

```
GET    /api/v1/analytics/dashboard         -- загальна статистика
GET    /api/v1/analytics/consultants       -- метрики консультантів
GET    /api/v1/analytics/cases             -- статистика кейсів
GET    /api/v1/analytics/courses           -- статистика курсів
GET    /api/v1/analytics/quality-report    -- звіт якості (супервізор)
```

#### ChannelsModule (Webhooks)

```
POST   /api/v1/channels/telegram/webhook     -- Telegram webhook
POST   /api/v1/channels/instagram/webhook     -- Instagram webhook
GET    /api/v1/channels/instagram/webhook      -- Instagram verification
POST   /api/v1/channels/facebook/webhook      -- Facebook webhook
GET    /api/v1/channels/facebook/webhook       -- Facebook verification
POST   /api/v1/channels/viber/webhook         -- Viber webhook
```

---

## 4. Real-time архітектура (Socket.io)

### Схема

```
                Angular SPA
                    |
                    | Socket.io (WSS)
                    v
            +---------------+
            | Gateway       |
            | (NestJS)      |
            |               |
            | Namespaces:   |
            | /chat         |
            | /notifications|
            | /presence     |
            +-------+-------+
                    |
            +-------v-------+
            |   Event Bus   |
            | Redis Adapter |  // finding #47: @socket.io/redis-adapter з початку
            | (Redis Pub/   |  // для multi-instance scaling
            |    Sub)       |
            +---------------+
```

### Namespace: /chat

**Client --> Server:**

| Подія | Payload | Опис |
|---|---|---|
| `chat:join` | `{ careCaseId }` | Приєднатися до кімнати кейсу |
| `chat:leave` | `{ careCaseId }` | Покинути кімнату |
| `chat:message` | `{ careCaseId, content, attachments? }` | Надіслати повідомлення. EDGE CASE #9: DB write fails після Socket.io broadcast → НЕ broadcast'ити до успішного збереження в БД. Порядок: 1) persist в БД, 2) broadcast в кімнату. При помилці persist — emit `chat:error` відправнику з кодом `PERSIST_FAILED`, не транслювати незбережені повідомлення |
| `chat:typing` | `{ careCaseId }` | Індикатор друку |
| `chat:read` | `{ careCaseId, messageId }` | Позначити прочитаним |

**Server --> Client:**

| Подія | Payload | Опис |
|---|---|---|
| `chat:message` | `{ message }` | Нове повідомлення |
| `chat:typing` | `{ userId, firstName }` | Хтось друкує |
| `chat:read` | `{ messageId, readAt }` | Повідомлення прочитано |
| `chat:error` | `{ code, message }` | Помилка |

### Namespace: /notifications

**Server --> Client:**

| Подія | Payload | Опис |
|---|---|---|
| `notification:new` | `{ notification }` | Нове сповіщення |
| `notification:count` | `{ unreadCount }` | Оновлений лічильник |

### Namespace: /presence

**Client --> Server:**

| Подія | Payload | Опис |
|---|---|---|
| `presence:online` | `{}` | Користувач онлайн. EDGE CASE #16: Клієнт crashується без disconnect → Серверний heartbeat timeout: якщо немає ping/pong 60 секунд, автоматично позначити offline. Socket.io config: `{ pingInterval: 25000, pingTimeout: 60000 }` |
| `presence:away` | `{}` | Користувач відійшов |

**Server --> Client:**

| Подія | Payload | Опис |
|---|---|---|
| `presence:update` | `{ userId, status }` | Статус користувача змінився |
| `presence:list` | `{ users: [{id, status}] }` | Список онлайн користувачів |

### Автентифікація Socket.io

```typescript
// Client
const socket = io('/chat', {
  auth: {
    token: 'Bearer <JWT>'
  }
});

// Server (NestJS Gateway)
@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection {
  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    const user = await this.authService.validateToken(token);
    if (!user) {
      client.disconnect();
      return;
    }
    client.data.user = user;

    // finding #24: periodic token revalidation для active WebSocket sessions
    const revalidateInterval = setInterval(async () => {
      try {
        // Re-read token from handshake auth on each tick (client may have refreshed it)
        const currentToken = client.handshake.auth.token;
        const revalidated = await this.authService.validateToken(currentToken);
        if (!revalidated || !revalidated.isActive) {
          client.emit('chat:error', { code: 'TOKEN_EXPIRED', message: 'Session expired' });
          client.disconnect();
          clearInterval(revalidateInterval);
        }
      } catch {
        client.disconnect();
        clearInterval(revalidateInterval);
      }
    }, 5 * 60 * 1000); // кожні 5 хвилин

    client.on('disconnect', () => clearInterval(revalidateInterval));
  }
}

// Edge cases: reconnect storm (jittered delay), memory leak (removeAllListeners при disconnect),
// e2e encryption для кризисних повідомлень — див. секцію 13.3
```

### Авторизація кімнати

Консультант може приєднатися тільки до кімнати свого кейсу. Людина — тільки до свого кейсу.

```typescript
@SubscribeMessage('chat:join')
async handleJoin(client: Socket, payload: { careCaseId: string }) {
  const user = client.data.user;
  const hasAccess = await this.casesService.hasAccess(user.id, payload.careCaseId);
  if (!hasAccess) {
    client.emit('chat:error', { code: 'FORBIDDEN', message: 'No access' });
    return;
  }
  client.join(`case:${payload.careCaseId}`);
}
```

---

## 5. Омніканальний Message Bus

### Архітектура адаптерів

```
  Telegram      Instagram     Facebook      Viber         Web
  Webhook       Webhook       Webhook       Webhook       Socket.io
     |              |             |             |             |
     v              v             v             v             v
  +----------+ +----------+ +----------+ +----------+ +----------+
  | Telegram | |Instagram | | Facebook | |  Viber   | |   Web    |
  | Adapter  | | Adapter  | | Adapter  | | Adapter  | | Adapter  |
  +----+-----+ +----+-----+ +----+-----+ +----+-----+ +----+-----+
       |             |            |            |            |
       +------+------+-----+-----+------+-----+            |
              |             |            |                  |
              v             v            v                  |
       +------+-------------+------------+---------+--------+
       |                                                    |
       |           ChannelRouter (NestJS Service)           |
       |                                                    |
       |   1. Ідентифікує канал і chat ID                   |
       |   2. Знаходить або створює Person                  |
       |   3. Знаходить або створює CareCase                |
       |   4. Зберігає Message в БД                         |
       |   5. Сповіщує консультанта через Socket.io         |
       |   6. Запускає CrisisDetection                      |
       |                                                    |
       +----------------------------------------------------+
```

### Інтерфейс адаптера

```typescript
// channels/interfaces/channel-adapter.interface.ts

export interface IncomingMessage {
  channelChatId: string;
  senderChannelId: string;  // telegram user id, instagram scoped id
  senderName?: string;
  content: string;
  attachments?: Attachment[];
  isEdited?: boolean;        // finding #41: edited message flag
  rawPayload: any;
}

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

export interface ChannelAdapter {
  readonly channel: MessageChannel;

  // Parse incoming webhook into universal format
  parseIncoming(body: any, headers: any): IncomingMessage | null;

  // Send message to channel
  sendMessage(channelChatId: string, content: string, attachments?: Attachment[]): Promise<string>;

  // Verify webhook signature
  verifyWebhook(body: any, headers: any): boolean;
}
```

### Webhook Signature Guard (finding #27)

```typescript
// channels/guards/webhook-signature.guard.ts

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(private readonly channelRouter: ChannelRouterService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const channel = request.params.channel; // telegram, instagram, etc.
    const adapter = this.channelRouter.getAdapter(channel);
    if (!adapter) {
      throw new NotFoundException(`No adapter for channel '${channel}'`);
    }
    if (!adapter.verifyWebhook(request.body, request.headers)) {
      throw new ForbiddenException('Invalid webhook signature');
    }
    return true;
  }
}

// Usage on webhook controllers:
@UseGuards(WebhookSignatureGuard)
@Post('channels/:channel/webhook')
handleWebhook(@Body() body: any) { ... }
```

### Потік вхідного повідомлення

```
  1. Telegram надсилає webhook POST /api/v1/channels/telegram/webhook
                                |
  2. TelegramAdapter.verifyWebhook() -- перевірити підпис
                                |
  3. TelegramAdapter.parseIncoming() -- конвертувати в IncomingMessage
                                |
  4. ChannelRouter.handleIncoming(channel, message)
        |
        +-- 4a. Знайти Person за telegramChatId
        |       Якщо немає -- створити Person + User
        |       EDGE CASE #2: Дублікат webhook для нової Person → Upsert або catch Prisma P2002 на telegramChatId unique constraint, повернути існуючу Person замість помилки
        |
        +-- 4b. Знайти активний CareCase для цієї людини
        |       Якщо немає -- створити новий CareCase (source: telegram)
        |       EDGE CASE: Якщо знайдений CareCase має status=on_hold — перевести в in_progress
        |       перед прикріпленням повідомлення (нове повідомлення = людина повернулась до діалогу).
        |       EDGE CASE: ALLOWED_TRANSITIONS не перевіряється перед on_hold→in_progress →
        |       Валідувати перехід через state machine перед оновленням статусу:
        |       if (careCase.status === 'on_hold') {
        |         if (!ALLOWED_TRANSITIONS[careCase.status]?.includes('in_progress')) {
        |           this.logger.warn(`State machine rejected on_hold→in_progress for case ${careCase.id}`);
        |         } else {
        |           await casesService.updateStatus(careCase.id, 'in_progress');
        |         }
        |       }
        |
        +-- 4c. Зберегти Message в БД
        |
        +-- 4d. Emitувати Socket.io подію консультанту
        |
        +-- 4e. CrisisDetection.scan(message)
        |
        +-- 4f. SlaService.trackNewMessage(caseId)
```

### Потік вихідного повідомлення

```
  1. Консультант пише повідомлення через web-інтерфейс
                                |
  2. ChatGateway отримує 'chat:message'
                                |
  3. MessageService.create(careCaseId, content, senderId)
        |
        +-- 3a. Зберегти в БД
        |
        +-- 3b. Визначити канал людини (finding #38: preferredChannel з Person profile, fallback на останній канал)
        |
        +-- 3c. Якщо канал != 'web':
        |       ChannelRouter.sendOutgoing(channel, channelChatId, content)
        |       -> Adapter.sendMessage()
        |       EDGE CASE #13: Adapter.sendMessage() throws (мережева помилка, rate limit) → Catch помилку, поставити в Bull retry queue з exponential backoff, позначити message.deliveryStatus = 'pending'. Після успішної доставки — оновити на 'delivered'
        |
        +-- 3d. Emitувати Socket.io подію в кімнату кейсу
```

### Приклад: Telegram Adapter

```typescript
// channels/adapters/telegram.adapter.ts

@Injectable()
export class TelegramAdapter implements ChannelAdapter {
  readonly channel = MessageChannel.telegram;

  constructor(private readonly httpService: HttpService) {}

  parseIncoming(body: TelegramUpdate): IncomingMessage | null {
    // finding #41: handle edited_message замість тільки message
    const msg = body.message || body.edited_message;
    if (!msg) return null;

    return {
      channelChatId: String(msg.chat.id),
      senderChannelId: String(msg.from.id),
      senderName: [msg.from.first_name, msg.from.last_name]
        .filter(Boolean).join(' '),
      content: msg.text || msg.caption || '',
      attachments: this.parseAttachments(msg),
      isEdited: !!body.edited_message, // finding #41: flag edited messages
      rawPayload: body,
    };
  }

  // Edge case: Telegram API rate limit (30 msg/sec) — використовувати Bull queue з throttling (див. секцію 13.8)
  async sendMessage(
    channelChatId: string,
    content: string,
  ): Promise<string> {
    const response = await this.httpService.axiosRef.post(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      { chat_id: channelChatId, text: content },
    );
    return String(response.data.result.message_id);
  }

  verifyWebhook(body: any, headers: any): boolean {
    const secret = headers['x-telegram-bot-api-secret-token'];
    return secret === this.webhookSecret;
  }
}
```

---

## 6. Алгоритм авто-призначення

### Логіка призначення

```
Вхід: CareCase { topic, language, priority, crisisLevel }

Крок 1: ФІЛЬТРАЦІЯ за спеціалізацією
  consultants.filter(c =>
    c.specializations.includes(case.topic) &&
    c.status === 'active'
  )
  -> Якщо порожній список -> повернути null (ручне призначення)

Крок 2: ФІЛЬТРАЦІЯ за мовою
  filtered.filter(c =>
    c.languages.includes(person.language)
  )
  -> Якщо порожній -> повернути всіх з кроку 1 (мова — м'який фільтр)

Крок 3: ФІЛЬТРАЦІЯ за доступністю
  filtered.filter(c =>
    isAvailableNow(c.availability) ||
    case.priority !== 'crisis' // для не-кризових можна зачекати
  )

Крок 4: ФІЛЬТРАЦІЯ за навантаженням
  filtered.filter(c => {
    const activeCases = countActiveCases(c.id);
    if (case.crisisLevel >= 'high') {
      return countCrisisCases(c.id) < c.maxCrisisCases;
    }
    return activeCases < c.maxCases;
  })

Крок 5: СОРТУВАННЯ за навантаженням (від найменшого)
  filtered.sort((a, b) =>
    countActiveCases(a.id) - countActiveCases(b.id)
  )

Крок 6: ВИБРАТИ першого

Крок 7: Якщо кризовий і нікого немає -> ЕСКАЛАЦІЯ
  -> Сповістити координатора
  -> Сповістити чергового супервізора
```

### Дерево рішень

```
  Нове звернення
       |
       v
  Спеціалізація збігається?
       |          |
      Так        Ні --> Сповістити координатора
       |                (ручне призначення)
       v
  Мова збігається?
       |          |
      Так        Частково --> Повернути всіх зі спеціалізацією
       |                     (мова — м'який фільтр)
       v
  Є доступні зараз?
       |          |
      Так        Ні --> Якщо криза --> ескалація
       |                Якщо ні --> призначити офлайн
       v                           консультанту з найменшим
  Навантаження < max?              навантаженням
       |          |
      Так        Ні --> Наступний консультант
       |
       v
  Призначено! Сповіщення консультанту
```

### NestJS імплементація

```typescript
// assignment/assignment.service.ts

@Injectable()
export class AssignmentService {
  async autoAssign(careCaseId: string): Promise<Consultant | null> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: careCaseId },
      include: { person: true },
    });

    // finding #29: null check — кейс міг бути видалений між викликами
    if (!careCase) {
      throw new NotFoundException(`CareCase ${careCaseId} not found`);
    }

    // Null check: person may not be loaded if relation is broken
    if (!careCase.person) {
      await this.notifyCoordinator(careCase, 'PERSON_NOT_FOUND');
      return null;
    }

    // finding #30: guard null topic before Prisma query
    if (!careCase.topic) {
      await this.notifyCoordinator(careCase, 'NO_TOPIC_SET');
      return null;
    }

    let candidates = await this.prisma.consultant.findMany({
      where: {
        status: 'active',
        specializations: { hasSome: [careCase.topic] },
      },
    });

    if (candidates.length === 0) {
      await this.notifyCoordinator(careCase, 'NO_MATCHING_SPECIALIZATION');
      return null;
    }

    // Soft filter by language
    const langMatch = candidates.filter(c =>
      c.languages.includes(careCase.person.language),
    );
    if (langMatch.length > 0) {
      candidates = langMatch;
    }

    // finding #32: filter by availability schedule + status (не тільки 'active')
    const now = new Date();
    const currentDay = now.getDay();
    // EDGE CASE #4: Consultant availability використовує не-Київський timezone → Конвертувати currentTime в timezone консультанта перед порівнянням
    // const consultantTz = availability.timezone || 'Europe/Kyiv';
    // const currentTimeInTz = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: consultantTz, hour12: false }).format(now);
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (careCase.priority !== 'crisis') {
      // Для не-кризових — фільтрувати за доступністю
      const availableNow = [];
      for (const c of candidates) {
        const availability = await this.prisma.availability.findFirst({
          where: {
            consultantId: c.id,
            dayOfWeek: currentDay,
            startTime: { lte: currentTime },
            endTime: { gt: currentTime },
          },
        });
        if (availability) availableNow.push(c);
      }
      // Якщо хтось доступний зараз — використовувати тільки їх
      if (availableNow.length > 0) {
        candidates = availableNow;
      }
      // Інакше — призначити офлайн консультанту з найменшим навантаженням
    }

    // Filter by workload
    const withWorkload = await Promise.all(
      candidates.map(async c => ({
        consultant: c,
        activeCases: await this.countActiveCases(c.id),
        crisisCases: await this.countCrisisCases(c.id),
      })),
    );

    const available = withWorkload.filter(w => {
      if (careCase.crisisLevel !== 'none') {
        return w.crisisCases < w.consultant.maxCrisisCases
          && w.activeCases < w.consultant.maxCases;
      }
      return w.activeCases < w.consultant.maxCases;
    });

    if (available.length === 0) {
      // EDGE CASE: Кризовий кейс, але всі консультанти відфільтровані за навантаженням →
      // Замість повернення null — ескалація (крок 7): сповістити координатора та чергового супервізора
      // EDGE CASE: CareCase з crisisLevel='low' потрапляє у workload filter → low теж є кризовий рівень,
      // потребує ескалації нарівні з high/critical, щоб кейс не залишився без призначення
      if (careCase.crisisLevel === 'low' || careCase.crisisLevel === 'high' || careCase.crisisLevel === 'critical') {
        await this.escalateCrisis(careCase);
        return null;
      }
      await this.notifyCoordinator(careCase, 'ALL_CONSULTANTS_FULL');
      return null;
    }

    // Sort by workload (ascending)
    available.sort((a, b) => a.activeCases - b.activeCases);

    const selected = available[0].consultant;

    // finding #31: optimistic concurrency — transaction + перевірка навантаження
    const assigned = await this.prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE через raw query для запобігання race condition
      const currentLoad = await tx.careCase.count({
        where: { consultantId: selected.id, status: { in: ['assigned', 'in_progress', 'meeting_scheduled'] } },
      });
      if (currentLoad >= selected.maxCases) {
        return null; // consultant перевищив ліміт через concurrent assignment
      }

      await tx.careCase.update({
        where: { id: careCaseId },
        data: {
          consultantId: selected.id,
          status: 'assigned',
        },
      });
      return selected;
    });

    if (!assigned) {
      // EDGE CASE: Передчасна ескалація координатору при наявності інших кандидатів →
      // Перебрати наступних кандидатів з відсортованого available масиву перед notifyCoordinator
      for (let i = 1; i < available.length; i++) {
        const next = available[i].consultant;
        const retryAssigned = await this.prisma.$transaction(async (tx) => {
          const currentLoad = await tx.careCase.count({
            where: { consultantId: next.id, status: { in: ['assigned', 'in_progress', 'meeting_scheduled'] } },
          });
          if (currentLoad >= next.maxCases) return null;
          await tx.careCase.update({
            where: { id: careCaseId },
            data: { consultantId: next.id, status: 'assigned' },
          });
          return next;
        });
        if (retryAssigned) {
          await this.notificationService.send({
            userId: retryAssigned.userId,
            type: 'case_assigned',
            title: 'Нове звернення',
            data: { careCaseId },
          });
          return retryAssigned;
        }
      }
      // Всі кандидати вичерпані — тепер ескалація
      await this.notifyCoordinator(careCase, 'CONCURRENT_ASSIGNMENT_CONFLICT');
      return null;
    }

    await this.notificationService.send({
      userId: selected.userId,
      type: 'case_assigned',
      title: 'Нове звернення',
      data: { careCaseId },
    });

    return selected;
  }

  // finding #9: atomic transfer — CaseTransfer + CareCase update в одній транзакції
  async transferCase(careCaseId: string, fromId: string, toId: string, reason: TransferReason, initiatedBy: string): Promise<CaseTransfer> {
    if (fromId === toId) {
      throw new BadRequestException('Cannot transfer case to the same consultant'); // finding #8
    }

    // Validate that fromConsultantId matches current case assignment
    const careCase = await this.prisma.careCase.findUnique({ where: { id: careCaseId } });
    if (!careCase) {
      throw new NotFoundException(`CareCase ${careCaseId} not found`);
    }
    if (careCase.consultantId !== fromId) {
      throw new ConflictException('Consultant mismatch: fromConsultantId does not match current case consultant');
    }

    // EDGE CASE #5: Transfer до консультанта, який вже на maxCases → Перевірити workload < maxCases всередині транзакції
    return this.prisma.$transaction(async (tx) => {
      const toConsultant = await tx.consultant.findUnique({ where: { id: toId } });
      if (!toConsultant) throw new NotFoundException('Target consultant not found');
      // EDGE CASE: Цільовий консультант може мати status != active (on_vacation, training, inactive) →
      // Перевірити статус перед трансфером, щоб не передати кейс недоступному консультанту
      if (toConsultant.status !== 'active') {
        throw new ConflictException(`Target consultant is not active (status: ${toConsultant.status})`);
      }
      const currentLoad = await tx.careCase.count({
        where: { consultantId: toId, status: { in: ['assigned', 'in_progress', 'meeting_scheduled'] } },
      });
      if (currentLoad >= toConsultant.maxCases) {
        throw new ConflictException('Target consultant is at maximum case capacity');
      }

      const transfer = await tx.caseTransfer.create({
        data: { careCaseId, fromConsultantId: fromId, toConsultantId: toId, reason, initiatedBy },
      });
      await tx.careCase.update({
        where: { id: careCaseId },
        data: { consultantId: toId, status: 'transferred' },
      });
      return transfer;
    });
  }
}
```

---

## 7. SLA Engine

### Правила SLA

| Подія | Таймер | Дія | Адресат |
|---|---|---|---|
| Кейс без відповіді | 4 год | Push-сповіщення | Консультант |
| Кейс без відповіді | 12 год | Email + push | Консультант |
| Кейс без відповіді | 24 год | Авто-перепризначення | Координатор |
| Кейс без відповіді | 48 год | Критичне сповіщення | Адмін |
| Переписка неактивна | 48 год | Нагадування | Консультант |
| Переписка неактивна | 5 днів | Сповіщення | Координатор |
| Переписка неактивна | 7 днів | Статус -> "Пауза" | Людина отримує повідомлення |
| Криза без реакції | 15 хв | SMS + push | Координатор + черговий супервізор |
| Криза без реакції | 1 год | Авто-призначення іншому | Інший консультант |

### Архітектура SLA Engine

```
  +-------------------+
  | Cron Job          |  Кожні 5 хвилин
  | (NestJS Cron)     |
  +--------+----------+
           |
           v
  +--------+----------+
  | SlaService        |
  |                   |
  | checkUnanswered() |----> Знайти кейси без відповіді
  | checkInactive()   |----> Знайти неактивні переписки
  | checkCrisis()     |----> Знайти кризові кейси без реакції
  +--------+----------+
           |
           v
  +--------+----------+
  | NotificationSvc   |----> Push / Email / SMS
  +-------------------+
           |
           v
  +--------+----------+
  | SlaEvent (БД)     |----> Журнал всіх SLA подій
  +-------------------+
```

### Імплементація

```typescript
// sla/sla.service.ts

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  // Edge case: при кількох інстансах — distributed lock через Redis (див. секцію 13.4)
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSlaCompliance() {
    await this.checkUnansweredCases();
    await this.checkInactiveCases();
  }

  // finding #35: dedicated sub-minute scheduler для кризових кейсів (15 хв SLA)
  @Cron('*/1 * * * *') // кожну хвилину
  async checkCrisisSla() {
    await this.checkCrisisResponse();
  }

  private async checkUnansweredCases() {
    const now = new Date();

    // finding #34: cursor-based pagination замість findMany для всіх кейсів
    let cursor: string | undefined;
    const batchSize = 100;

    while (true) {
      // EDGE CASE #17: SLA таймер продовжує працювати для on_hold кейсів → Виключити on_hold зі SLA запитів
      const unanswered = await this.prisma.careCase.findMany({
        where: {
          status: { in: ['new', 'assigned'] }, // on_hold explicitly excluded
          firstResponseAt: null,
        },
        include: { consultant: { include: { user: true } } },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });

      if (unanswered.length === 0) break;
      cursor = unanswered[unanswered.length - 1].id;

      for (const c of unanswered) {
        const hoursOpen = differenceInHours(now, c.createdAt);

        // Process ALL matching thresholds (no else-if) so that breached
        // higher tiers also emit lower-tier events if not already recorded.
        // Duplicate prevention is handled by escalate() via @@unique([careCaseId, level]).
        if (hoursOpen >= 4) {
          await this.escalate(c, 'warning_4h', 'consultant');
        }
        if (hoursOpen >= 12) {
          await this.escalate(c, 'warning_12h', 'consultant');
        }
        if (hoursOpen >= 24) {
          await this.escalate(c, 'breach_24h', 'coordinator');
          // EDGE CASE #6: autoReassign може зациклитись (reassign → знову без відповіді → reassign) → Guard: перевірити CaseTransfer за останні 24h; якщо вже був transfer — не reassign'ити повторно
          const recentTransfer = await this.prisma.caseTransfer.findFirst({
            where: { careCaseId: c.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          });
          if (!recentTransfer) {
            await this.autoReassign(c);
          }
        }
        if (hoursOpen >= 48) {
          await this.escalate(c, 'critical_48h', 'admin');
        }
      }
    }
  }

  // EDGE CASE #7: checkInactiveCases() — referenced в checkSlaCompliance() але не реалізований → Імплементувати з cursor pagination аналогічно checkUnansweredCases:
  // private async checkInactiveCases() {
  //   let cursor: string | undefined;
  //   while (true) {
  //     const inactive = await this.prisma.careCase.findMany({
  //       where: { status: { in: ['in_progress', 'meeting_scheduled'] }, /* NOT on_hold */ },
  //       include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  //       take: 100, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
  //     });
  //     if (inactive.length === 0) break;
  //     cursor = inactive[inactive.length - 1].id;
  //     for (const c of inactive) {
  //       const lastMsg = c.messages[0];
  //       if (!lastMsg) continue;
  //       const hoursInactive = differenceInHours(now, lastMsg.createdAt);
  //       if (hoursInactive >= 48) await this.escalate(c, 'inactive_48h', 'consultant'); // нагадування (окремий SlaLevel, не reuse warning_4h)
  //       if (hoursInactive >= 120) await this.escalate(c, 'inactive_5d', 'coordinator'); // 5 днів → координатор (окремий SlaLevel, не reuse warning_12h)
  //       if (hoursInactive >= 168) { // 7 днів → статус on_hold + повідомлення Person
  //         // EDGE CASE: Перед зміною на on_hold — валідувати перехід через state machine.
  //         // Стан machine може відхилити перехід (напр. meeting_scheduled → on_hold дозволений,
  //         // але інші стани можуть бути заборонені). Перевірити ALLOWED_TRANSITIONS перед оновленням:
  //         if (ALLOWED_TRANSITIONS[c.status]?.includes('on_hold')) {
  //           await tx.careCase.update({ where: { id: c.id }, data: { status: 'on_hold' } });
  //           await this.channelRouter.sendOutgoing(c, 'Ваш кейс переведено на паузу через відсутність активності.');
  //         } else {
  //           this.logger.warn(`Cannot transition case ${c.id} from ${c.status} to on_hold — state machine rejected`);
  //         }
  //       }
  //     }
  //   }
  // }

  // finding #33: перевірка дублікатів SLA event перед створенням
  private async escalate(careCase: CareCase, level: SlaLevel, targetRole: string) {
    const existing = await this.prisma.slaEvent.findUnique({
      where: { careCaseId_level: { careCaseId: careCase.id, level } },
    });
    if (existing) return; // вже створено, не дублювати

    await this.prisma.slaEvent.create({
      data: { careCaseId: careCase.id, level, message: `SLA ${level} for case ${careCase.id}` },
    });
    await this.notificationService.sendByRole(targetRole, { type: `sla_${level}`, careCaseId: careCase.id });
  }
}
```

---

## 8. Crisis Detection

### Архітектура

```
  Вхідне повідомлення
           |
           v
  +--------+----------+
  | CrisisDetector    |
  |                   |
  | 1. Keyword scan   |-- Словник кризових фраз (uk/ru/en)
  | 2. Pattern match  |-- Регулярні вирази
  | 3. Risk scoring   |-- Балова система
  | 4. Level assign   |-- none/low/medium/high/critical
  +--------+----------+
           |
           v
  +--------+----------+
  | Дія за рівнем     |
  |                   |
  | LOW:    лог       |
  | MEDIUM: сповіщ.   |
  |         консульт. |
  | HIGH:   сповіщ.   |
  |         коорд. +  |
  |         автовідп. |
  | CRITICAL: SMS     |
  |         коорд. +  |
  |         супервізор|
  +-------------------+
```

### Словник кризових фраз (мультимовний)

```typescript
// crisis/crisis-keywords.ts

export interface CrisisKeywordSet {
  uk: string[];
  ru: string[];
  en: string[];
}

export const CRISIS_KEYWORDS: Record<string, CrisisKeywordSet> = {
  critical: {
    uk: [
      'не хочу жити',
      'хочу померти',
      'суїцид',
      'покінчити з життям',
      'покінчити з усім',
      'вб\'ю себе',
      'повішусь',
      'остання ніч',
      'прощайте назавжди',
      'краще б мене не було',
    ],
    ru: [
      'не хочу жить',
      'хочу умереть',
      'суицид',
      'покончить с жизнью',
      'покончить со всем',
      'убью себя',
      'повешусь',
      'последняя ночь',
      'прощайте навсегда',
      'лучше бы меня не было',
    ],
    en: [
      'don\'t want to live',
      'want to die',
      'suicide',
      'end my life',
      'end it all',
      'kill myself',
      'last night alive',
      'goodbye forever',
    ],
  },
  high: {
    uk: [
      'мене б\'ють',
      'насильство',
      'не можу вийти з дому',
      'погрожує',
      'вдарив',
      'боюсь за життя',
      'зґвалтував',
      'залишити дітей',
      'замкнув мене',
      'погрожує зброєю',
    ],
    ru: [
      'меня бьют',
      'насилие',
      'не могу выйти из дома',
      'угрожает',
      'ударил',
      'боюсь за жизнь',
      'изнасиловал',
      'оставить детей',
      'запер меня',
      'угрожает оружием',
    ],
    en: [
      'being beaten',
      'violence',
      'can\'t leave home',
      'threatening me',
      'hit me',
      'fear for my life',
      'raped',
      'locked me in',
    ],
  },
  medium: {
    uk: [
      'не бачу сенсу',
      'все безнадійно',
      'ніхто не розуміє',
      'самотня',
      'болить дуже',
      'не можу більше',
      'не виходжу з дому',
      'тривожність',
      'не сплю тиждень',
      'панічні атаки',
      'все марно',
      'хочу зникнути',
    ],
    ru: [
      'не вижу смысла',
      'всё безнадёжно',
      'никто не понимает',
      'одинока',
      'больно очень',
      'не могу больше',
      'не выхожу из дома',
      'тревожность',
      'не сплю неделю',
      'панические атаки',
      'всё бесполезно',
      'хочу исчезнуть',
    ],
    en: [
      'no point',
      'hopeless',
      'nobody understands',
      'so alone',
      'hurts so much',
      'can\'t take it anymore',
      'not leaving home',
      'anxiety',
      'haven\'t slept',
      'panic attacks',
    ],
  },
};
```

### Логіка сканування

```typescript
// crisis/crisis.service.ts

@Injectable()
export class CrisisService {
  async scanMessage(message: Message): Promise<CrisisLevel> {
    // Only scan messages from persons, not from consultants/system
    if (message.senderRole !== 'person') {
      return 'none';
    }

    const text = (message.content || '').toLowerCase();
    let level: CrisisLevel = 'none';
    const matchedPhrases: string[] = [];

    // EDGE CASE #8: Attachment-only повідомлення — вкладення з кризовими назвами файлів не скануються →
    // Сканувати також attachment filenames на кризові ключові слова
    if (message.attachments) {
      const attachments = typeof message.attachments === 'string' ? JSON.parse(message.attachments) : message.attachments;
      for (const att of (attachments as any[])) {
        if (att.name) {
          const filename = att.name.toLowerCase();
          // Перевірити filename через ті ж crisis keywords
          for (const lang of ['uk', 'ru', 'en'] as const) {
            for (const phrase of CRISIS_KEYWORDS.critical[lang]) {
              if (filename.includes(phrase)) {
                level = 'critical';
                matchedPhrases.push(`[attachment:${lang}] ${phrase}`);
              }
            }
          }
        }
      }
    }

    // finding #36: negation-aware pattern matching
    // EDGE CASE #20: 'не хочу жити' починається з заперечного префікса 'не ' — це false negative!
    // → Whitelist відомих кризових фраз, що містять заперечення. Ці фрази ЗАВЖДИ вважати кризовими, не перевіряти negation
    const NEGATION_WHITELIST = ['не хочу жити', 'не хочу жить', 'don\'t want to live', 'не бачу сенсу', 'не вижу смысла', 'не можу більше', 'не могу больше'];
    const NEGATION_PREFIXES = ['не ', 'ні ', 'ніколи не ', 'не хочу ', 'нет ', 'не буду ', 'never ', 'don\'t ', 'won\'t '];
    const isNegated = (text: string, phrase: string): boolean => {
      // Фрази з whitelist ніколи не вважаються "запереченими"
      if (NEGATION_WHITELIST.includes(phrase)) return false;
      const idx = text.indexOf(phrase);
      if (idx <= 0) return false;
      const before = text.substring(Math.max(0, idx - 20), idx);
      // Перевірити чи фраза в контексті заперечення кризи (напр. "я більше не хочу померти")
      return NEGATION_PREFIXES.some(neg => before.endsWith(neg) && phrase !== neg.trim());
    };

    // Scan all languages
    for (const lang of ['uk', 'ru', 'en'] as const) {
      for (const phrase of CRISIS_KEYWORDS.critical[lang]) {
        if (text.includes(phrase) && !isNegated(text, phrase)) {
          level = 'critical';
          matchedPhrases.push(`[${lang}] ${phrase}`);
        }
      }
    }

    if (level === 'none') {
      for (const lang of ['uk', 'ru', 'en'] as const) {
        for (const phrase of CRISIS_KEYWORDS.high[lang]) {
          if (text.includes(phrase) && !isNegated(text, phrase)) {
            level = 'high';
            matchedPhrases.push(`[${lang}] ${phrase}`);
          }
        }
      }
    }

    if (level === 'none') {
      for (const lang of ['uk', 'ru', 'en'] as const) {
        for (const phrase of CRISIS_KEYWORDS.medium[lang]) {
          if (text.includes(phrase) && !isNegated(text, phrase)) {
            level = 'medium';
            matchedPhrases.push(`[${lang}] ${phrase}`);
          }
        }
      }
    }

    if (level !== 'none') {
      await this.handleCrisis(message, level, matchedPhrases);
    }

    return level;
  }

  private async handleCrisis(
    message: Message,
    level: CrisisLevel,
    phrases: string[],
  ) {
    // Only upgrade crisis level, never downgrade (e.g. critical -> medium)
    const LEVEL_ORDER: Record<CrisisLevel, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const currentCase = await this.prisma.careCase.findUnique({ where: { id: message.careCaseId } });
    const effectiveLevel = currentCase
      ? LEVEL_ORDER[level] > LEVEL_ORDER[currentCase.crisisLevel] ? level : currentCase.crisisLevel
      : level;

    // Update crisis level on case
    // Edge case: Redis fallback при втраті з'єднання — див. секцію 13.1
    await this.prisma.careCase.update({
      where: { id: message.careCaseId },
      data: { crisisLevel: effectiveLevel, priority: 'crisis' },
    });

    if (level === 'critical' || level === 'high') {
      // Notify coordinator and supervisor
      await this.notifyCoordinatorsAndSupervisors(message, level, phrases);

      // Auto-reply to person with emergency contacts
      await this.sendCrisisAutoReply(message.careCaseId, message.content);

      // EDGE CASE: Кризовий кейс без призначеного консультанта →
      // Викликати autoAssign для негайного призначення після сповіщень
      const caseForAssign = await this.prisma.careCase.findUnique({ where: { id: message.careCaseId } });
      if (caseForAssign && !caseForAssign.consultantId) {
        await this.assignmentService.autoAssign(message.careCaseId);
      }
    }

    if (level === 'medium') {
      // Notify assigned consultant; fall back to coordinator if no consultant assigned
      const caseData = await this.prisma.careCase.findUnique({ where: { id: message.careCaseId } });
      if (!caseData?.consultantId) {
        await this.notifyCoordinatorsAndSupervisors(message, level, phrases);
      } else {
        await this.notifyAssignedConsultant(message, level, phrases);
      }
    }

    // Audit log
    this.logger.warn(
      `CRISIS ${level}: case=${message.careCaseId}, phrases=[${phrases.join(', ')}]`,
    );
  }

  private async sendCrisisAutoReply(careCaseId: string, originalText: string) {
    // Detect language from original message to reply in same language
    const lang = this.detectLanguage(originalText);

    const replies: Record<string, string> = {
      uk: 'Ми вас чуємо. Консультант зв\'яжеться з вами якнайшвидше. ' +
          'Якщо вам зараз дуже важко, зателефонуйте на лінію підтримки: 7333 ' +
          '(безкоштовно з мобільного).',
      ru: 'Мы вас слышим. Консультант свяжется с вами как можно скорее. ' +
          'Если вам сейчас очень тяжело, позвоните на линию поддержки: 7333 ' +
          '(бесплатно с мобильного).',
      en: 'We hear you. A consultant will reach out to you as soon as possible. ' +
          'If you are in immediate distress, please call the support hotline: 7333 ' +
          '(free from mobile).',
    };

    await this.messageService.createSystemMessage(
      careCaseId,
      replies[lang] || replies.uk,
    );
  }

  private detectLanguage(text: string): string {
    // Simple heuristic: count Cyrillic chars specific to Ukrainian vs Russian
    const ukChars = (text.match(/[іїєґ]/gi) || []).length;
    const ruChars = (text.match(/[ыэъё]/gi) || []).length;
    const cyrillicChars = (text.match(/[а-яА-ЯіїєґІЇЄҐыэъёЫЭЪЁ]/g) || []).length;

    if (cyrillicChars === 0) return 'en';
    if (ukChars > ruChars) return 'uk';
    if (ruChars > 0) return 'ru';
    return 'uk'; // default
  }
}
```

---

## 9. Автентифікація та авторизація

### JWT архітектура

```
  +----------+     +----------+     +-----------+
  | Client   |---->| NestJS   |---->| PostgreSQL|
  |          |     | Guards   |     |           |
  | JWT in   |     | + Prisma |     | users,    |
  | Auth     |     |          |     | refresh   |
  | header   |     | RolesGuard    | tokens    |
  |          |     | CaseAccess   |           |
  |          |     | Guard        |           |
  +----------+     +----------+     +-----------+
```

### Стратегія токенів

```
Access Token:
  - Час життя: 15 хвилин
  - Зберігається: в пам'яті (Angular service)
  - Payload: { sub: userId, role, email }

Refresh Token:
  - Час життя: 7 днів
  - Зберігається: httpOnly cookie (SameSite=Strict) + БД (refresh_tokens)
  - Rotation: кожне оновлення — новий refresh token
  - Family tracking: при replay attack — revoke all tokens в family (finding #22)
  - CSRF protection: SameSite=Strict + X-CSRF-Token header для cookie-based endpoints (finding #26)

Token Cleanup:
  - Scheduled job: щоденно DELETE FROM refresh_tokens WHERE expires_at < now() (finding #21)

Rate Limiting (finding #25):
  - POST /auth/login: 5 req/min per IP
  - POST /auth/refresh: 10 req/min per IP
  - POST /auth/forgot-password: 3 req/min per IP
  - Всі інші auth endpoints: 20 req/min per IP

JWT Secret Rotation:
  - Підтримка двох ключів: JWT_SECRET (поточний) + JWT_SECRET_PREV (попередній)
  - JwtStrategy: спочатку verify з поточним, при невдачі — з попереднім
  - Після повного циклу refresh (7 днів) — видалити попередній ключ
  - Див. секцію 13.5 для деталей
```

### NestJS Guards

```typescript
// auth/guards/roles.guard.ts

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}

// Usage:
@Roles(UserRole.coordinator, UserRole.admin)
@Get('cases')
findAll() { ... }
```

```typescript
// auth/strategies/jwt.strategy.ts — finding #23: перевірка isActive

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  async validate(payload: JwtPayload): Promise<User> {
    // EDGE CASE: CaseAccessGuard звертається до user.consultantId, але findUnique без include
    // повертає User без поля consultantId → include consultant та person для заповнення зв'язаних id
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        consultant: { select: { id: true } },
        person: { select: { id: true } },
      },
    });
    // finding #23: deactivated user з valid JWT — відхилити
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is deactivated');
    }
    // Додати consultantId / personId на верхній рівень для CaseAccessGuard
    (user as any).consultantId = user.consultant?.id ?? null;
    (user as any).personId = user.person?.id ?? null;
    return user;
  }
}
```

### Data Isolation (ізоляція даних)

```typescript
// cases/guards/case-access.guard.ts

@Injectable()
export class CaseAccessGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const caseId = request.params.id;

    switch (user.role) {
      case 'admin':
        return true; // бачить все

      case 'coordinator':
        return true; // бачить все

      case 'supervisor':
        // finding #39: supervisor має тільки read access, reject write operations
        const method = request.method;
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          // EDGE CASE: Supervisor може додавати нотатки з isSupervisorNote=true →
          // Дозволити POST на endpoint notes, якщо body містить isSupervisorNote === true
          const isNotesEndpoint = request.path.match(/\/cases\/[^/]+\/notes\/?$/);
          if (method === 'POST' && isNotesEndpoint && request.body?.isSupervisorNote === true) {
            return true; // supervisor може створювати supervisor notes
          }
          return false; // supervisor не може модифікувати кейси
        }
        return true; // read-only access

      case 'consultant':
        // EDGE CASE #10: Користувач з role=consultant, але без Consultant profile row → null check consultantId
        if (!user.consultantId) {
          return false; // 403 — немає профілю консультанта
        }
        // тільки свої кейси
        const isAssigned = await this.prisma.careCase.count({
          where: { id: caseId, consultantId: user.consultantId },
        });
        return isAssigned > 0;

      case 'person':
        // тільки свій кейс
        const isOwner = await this.prisma.careCase.count({
          where: { id: caseId, personId: user.personId },
        });
        return isOwner > 0;

      default:
        return false;
    }
  }
}
```

### Матриця прав

```
+---------------------+--------+------+------+-------+-------+
| Ресурс              | Person | Cons | Supv | Coord | Admin |
+---------------------+--------+------+------+-------+-------+
| Свій профіль (R/W)  |   +    |  +   |  +   |   +   |   +   |
| Чужий профіль (R)   |   -    |  -   |  -   |   +   |   +   |
| Свій кейс (R/W)     |   +    |  +   |  -   |   -   |   +   |
| Всі кейси (R)       |   -    |  -   |  +   |   +   |   +   |
| Всі кейси (W)       |   -    |  -   |  -   |   +   |   +   |
| Призначення         |   -    |  -   |  -   |   +   |   +   |
| Переписка (своя)    |   +    |  +   |  -   |   -   |   +   |
| Переписка (вся)     |   -    |  -   |  R   |   R   |   +   |
| Нотатки (приватні)   |   -    |  +   |  -   |   -   |   -   |
| Нотатки супервізора  |   -    |  R   |  +   |   R   |   +   |
| Курси (R)           |   +    |  +   |  +   |   +   |   +   |
| Курси (W)           |   -    |  -   |  -   |   -   |   +   |
| Користувачі (CRUD)  |   -    |  -   |  -   |   -   |   +   |
| Аналітика           |   -    |  -   |  +   |   +   |   +   |
| Налаштування        |   -    |  -   |  -   |   -   |   +   |
+---------------------+--------+------+------+-------+-------+
```

---

## 10. Зберігання файлів

### Архітектура

```
  +----------+     +----------+     +------------+
  | Client   |---->| NestJS   |---->| S3 / R2    |
  |          |     | FilesSvc |     |            |
  | multipart|     |          |     | Buckets:   |
  | upload   |     | - resize |     | avatars/   |
  |          |     | - virus  |     | attachm/   |
  |          |     |   scan   |     | courses/   |
  +----------+     | - presign|     +------------+
                   +----------+
```

### Стратегія

- **Аватари**: bucket `avatars/`, resize до 256x256, WebP
- **Вкладення чату**: bucket `attachments/{caseId}/`, ліміт 10MB
- **Матеріали курсів**: bucket `courses/{courseId}/`, відео/PDF/аудіо
- **Presigned URL**: для завантаження та перегляду (час життя 1 год)
- **Virus scan**: перед збереженням (ClamAV або хмарний сервіс)
- **MIME validation**: перевірка magic bytes + MIME type (не тільки розширення) — див. секцію 13.6
- **Атомарність**: upload спочатку, запис в БД потім (не навпаки) — див. секцію 13.6

### API

```
POST   /api/v1/files/upload          -- завантажити файл
GET    /api/v1/files/:id/url          -- отримати presigned URL
DELETE /api/v1/files/:id              -- видалити
```

---

## 11. Deployment

### Docker Compose (dev/staging)

```yaml
# docker-compose.yml

version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    deploy:
      resources:
        limits:
          memory: 512M  # Edge case: OOM killed — див. секцію 13.7
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://ihelp:${POSTGRES_PASSWORD}@db:5432/ihelp # finding #44: password з env
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      S3_ENDPOINT: ${S3_ENDPOINT}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
    depends_on:
      db:
        condition: service_healthy  # Edge case: сервіси стартують раніше БД — див. секцію 13.7
      redis:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "4200:80"

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ihelp
      POSTGRES_USER: ihelp
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD} # finding #44: env variable замість hardcoded "secret"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ihelp"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432" # finding #43: bind до localhost only

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} # finding #43: password protection
    healthcheck:
      # EDGE CASE #21: Redis password видимий у healthcheck через -a flag (ps aux) → Використовувати REDISCLI_AUTH env var
      test: ["CMD-SHELL", "REDISCLI_AUTH=$${REDIS_PASSWORD} redis-cli ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    ports:
      - "127.0.0.1:6379:6379" # finding #43: bind до localhost only

volumes:
  pgdata:
```

### Dockerfile (NestJS Backend)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=builder /app/dist ./dist
# finding #45: production image без devDependencies — менша attack surface
USER node
EXPOSE 3000
# Edge case: graceful shutdown — app.enableShutdownHooks() в main.ts (див. секцію 13.7)
CMD ["node", "dist/main.js"]
```

### CI/CD Pipeline (GitHub Actions)

```
  Push to main
       |
       v
  +----+----+
  | Lint    |  npm run lint
  | Test    |  npm run test
  | Build   |  npm run build
  +----+----+
       |
       v
  +----+----+
  | Docker  |  docker build + push
  | Build   |  to registry
  +----+----+
       |
       v
  +----+----+
  | Prisma  |  npx prisma migrate diff (CI check — див. секцію 13.2)
  | Check   |  npx prisma migrate deploy
  | Migrate |  // finding #46: міграції МАЮТЬ бути backward-compatible
  +----+----+  // (expand-contract pattern: спочатку additive changes,
       |       //  потім deploy new app, потім cleanup old columns)
       v
  +----+----+
  | Deploy  |  docker compose up -d
  |         |  (або Kubernetes)
  +----+----+
```

### Середовища

| | Dev | Staging | Prod |
|---|---|---|---|
| БД | Local PG | Cloud PG (shared) | Cloud PG (dedicated) |
| Redis | Local | Cloud | Cloud (cluster) |
| Files | Local/MinIO | R2 | R2/S3 |
| SSL | - | Let's Encrypt | Cloudflare |
| Domain | localhost | staging.yeturbota | app.yeturbota |

---

## 12. Структура модулів NestJS

### Дерево проекту

```
src/
+-- main.ts
+-- app.module.ts
+-- common/
|   +-- decorators/        -- @Roles, @CurrentUser
|   +-- filters/           -- GlobalExceptionFilter (stack trace в лог, маскування у відповіді — секція 13.5)
|   +-- guards/            -- JwtAuthGuard, RolesGuard
|   +-- interceptors/      -- LoggingInterceptor (PII scrubbing — секція 13.5), TransformInterceptor
|   +-- pipes/             -- ValidationPipe
|   +-- dto/               -- PaginationDto, SortDto
|   +-- interfaces/        -- BaseService, PagedResult
|
+-- auth/
|   +-- auth.module.ts
|   +-- auth.controller.ts
|   +-- auth.service.ts
|   +-- strategies/        -- JwtStrategy, LocalStrategy
|   +-- guards/            -- JwtAuthGuard, RefreshTokenGuard
|   +-- dto/               -- LoginDto, RegisterDto
|
+-- users/
|   +-- users.module.ts
|   +-- users.controller.ts
|   +-- users.service.ts
|   +-- persons/
|   |   +-- persons.controller.ts
|   |   +-- persons.service.ts
|   +-- consultants/
|   |   +-- consultants.controller.ts
|   |   +-- consultants.service.ts
|   +-- dto/
|
+-- cases/
|   +-- cases.module.ts
|   +-- cases.controller.ts
|   +-- cases.service.ts
|   +-- notes/
|   |   +-- notes.controller.ts
|   |   +-- notes.service.ts
|   +-- guards/            -- CaseAccessGuard
|   +-- dto/
|
+-- chat/
|   +-- chat.module.ts
|   +-- chat.gateway.ts       -- Socket.io Gateway
|   +-- messages.controller.ts
|   +-- messages.service.ts
|   +-- dto/
|
+-- courses/
|   +-- courses.module.ts
|   +-- courses.controller.ts
|   +-- courses.service.ts
|   +-- lessons/
|   |   +-- lessons.controller.ts
|   |   +-- lessons.service.ts
|   +-- enrollments/
|   |   +-- enrollments.controller.ts
|   |   +-- enrollments.service.ts
|   +-- dto/
|
+-- meetings/
|   +-- meetings.module.ts
|   +-- meetings.controller.ts
|   +-- meetings.service.ts
|   +-- dto/
|
+-- notifications/
|   +-- notifications.module.ts
|   +-- notifications.controller.ts
|   +-- notifications.service.ts
|   +-- notifications.gateway.ts  -- Socket.io
|   +-- dto/
|
+-- channels/
|   +-- channels.module.ts
|   +-- channel-router.service.ts
|   +-- interfaces/
|   |   +-- channel-adapter.interface.ts
|   +-- adapters/
|   |   +-- telegram.adapter.ts
|   |   +-- instagram.adapter.ts
|   |   +-- facebook.adapter.ts
|   |   +-- viber.adapter.ts
|   |   +-- web.adapter.ts
|   +-- controllers/
|   |   +-- telegram-webhook.controller.ts
|   |   +-- instagram-webhook.controller.ts
|   |   +-- facebook-webhook.controller.ts
|   |   +-- viber-webhook.controller.ts
|
+-- assignment/
|   +-- assignment.module.ts
|   +-- assignment.controller.ts
|   +-- assignment.service.ts
|
+-- sla/
|   +-- sla.module.ts
|   +-- sla.service.ts        -- Cron-based monitoring
|
+-- crisis/
|   +-- crisis.module.ts
|   +-- crisis.service.ts
|   +-- crisis-keywords.ts
|
+-- analytics/
|   +-- analytics.module.ts
|   +-- analytics.controller.ts
|   +-- analytics.service.ts
|   +-- dto/
|
+-- files/
|   +-- files.module.ts
|   +-- files.controller.ts
|   +-- files.service.ts      -- S3/R2 integration
|
+-- prisma/
    +-- prisma.module.ts
    +-- prisma.service.ts
```

### Залежності між модулями

```
                    AppModule
                       |
       +-------+-------+-------+--------+
       |       |       |       |        |
       v       v       v       v        v
    Auth    Users   Cases    Chat    Courses
       \      |       |       |      /
        \     |       v       |     /
         \    |   Assignment  |    /
          \   |       |       |   /
           v  v       v       v  v
          Notifications    Channels
               |               |
               v               v
             SLA            Crisis
               \             /
                v           v
               Analytics
                   |
                   v
               PrismaModule (shared)
```

### Правила залежностей

1. **PrismaModule** — global, імпортується всіма модулями
2. **AuthModule** — імпортується модулями що потребують автентифікації
3. **NotificationsModule** — імпортується модулями що надсилають сповіщення
4. **Channels не знають про Cases напряму** — тільки через ChannelRouter
5. **SLA і Crisis не знають один про одного** — обидва працюють незалежно
6. **Analytics читає з read-only запитів** — не змінює дані

---

## 13. Edge Cases та захисні механізми

### 13.1 Redis та кешування

| Тригер | Захист |
|---|---|
| Redis з'єднання втрачено під час запису кризисного стану | Retry з exponential backoff + fallback на PostgreSQL для збереження кризисного стану. `RedisService` обгортає всі write-операції в try/catch з retry-логікою (max 3 спроби, backoff: 100ms → 200ms → 400ms). Якщо Redis недоступний — пишемо напряму в PostgreSQL таблицю `crisis_state_fallback` і ставимо задачу на sync назад у Redis після відновлення |
| Redis pub/sub повідомлення втрачено при перезапуску subscriber | Для критичних подій (crisis alerts, SLA breaches) використовувати Redis Streams замість pub/sub. Streams гарантують at-least-once delivery через consumer groups + acknowledgement. Pub/sub залишається тільки для некритичних подій (typing, presence) |

### 13.2 Prisma та PostgreSQL

| Тригер | Захист |
|---|---|
| Prisma transaction timeout при batch-оновленні кейсів | Налаштування `$transaction({ timeout: 10000 })` + розбиття batch-операцій на чанки по 50 записів. Кожний чанк — окрема транзакція з retry при timeout |
| Prisma `findMany` без пагінації при великій кількості кейсів | Обов'язкова cursor-based пагінація для всіх `findMany` запитів на колекціях, що можуть рости (cases, messages, notifications). Код-рев'ю правило: `findMany` без `take` — заборонено |
| Prisma connection pool exhaustion при довгих транзакціях | Pool monitoring через Prisma metrics (`prisma.$metrics`). Alert при використанні > 80% пулу. Налаштування `connection_limit` в `DATABASE_URL`. Довгі транзакції обмежені timeout (max 10 секунд) |
| PostgreSQL deadlock при одночасному оновленні пов'язаних записів | Retry на deadlock (Prisma error code P2034) — max 3 спроби з jittered backoff. Упорядкування locks: завжди спочатку `care_cases`, потім `messages`, потім `sla_events` |
| Prisma schema drift: міграції в dev відрізняються від production | CI check на кожний PR: `npx prisma migrate diff --from-migrations --to-schema-datamodel`. Якщо є розходження — CI fails. Production deploy тільки через `prisma migrate deploy` |
| Prisma raw query без параметризації | Заборона `$queryRawUnsafe` та `$executeRawUnsafe` — тільки `$queryRaw` з tagged template literals (Prisma.sql). Лінтер правило: ESLint rule `no-restricted-properties` для Raw Unsafe методів. Перевага: використовувати Prisma Client API замість raw queries |
| Prisma logging в development виводить SQL з даними | У production вимкнути `log: ['query']` в `PrismaClient` конструкторі. Дозволено тільки `log: ['error', 'warn']`. В `.env.production`: `PRISMA_LOG_LEVEL=error,warn` |

### 13.3 WebSocket та Real-time

| Тригер | Захист |
|---|---|
| WebSocket reconnect storm після перезапуску сервера | Client-side: jittered reconnection delay (`reconnectionDelay: 1000 + Math.random() * 3000`). Server-side: connection rate limiting — max 10 з'єднань/секунду з однієї IP. Socket.io config: `{ reconnectionDelayMax: 10000, randomizationFactor: 0.5 }` |
| Socket.io memory leak при витоку event listeners | `removeAllListeners()` при `disconnect` event в кожному Gateway. Моніторинг `process.listenerCount()` — alert при > 100 listeners на один event type. Використовувати `socket.once()` замість `socket.on()` для одноразових подій |
| WebSocket повідомлення не шифруються end-to-end | TLS (wss://) обов'язковий для всіх середовищ окрім localhost. Для кризисних повідомлень — додатковий рівень шифрування payload (AES-256-GCM) з ключем, специфічним для кейсу, перед відправкою через Socket.io |

### 13.4 Bull Queue та фонові задачі

| Тригер | Захист |
|---|---|
| Bull queue job застрягає в active state (worker crash) | Налаштування stalled job detection: `{ stalledInterval: 30000, maxStalledCount: 2 }`. Після 2 stall events — job переходить в failed з логуванням. Auto-retry з лімітом: `{ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }` |
| Паралельний запуск cron job на кількох інстансах | Distributed lock через Redis (`SET key NX EX ttl`) перед виконанням кожного cron job (SLA check, quality metrics aggregation). Використовувати `@nestjs/schedule` + `redlock` library. Lock TTL = очікуваний час виконання × 2 |
| Bull dashboard доступний без автентифікації | Middleware автентифікації для `/admin/queues` route. Доступ тільки для ролі `admin`. В production: окремий порт або VPN-only доступ |

### 13.5 Безпека та автентифікація

| Тригер | Захист |
|---|---|
| CORS middleware пропускає запити без Origin header | Явна перевірка `Origin` header. Запити без Origin (server-to-server, curl) — reject для browser-targeted endpoints. Whitelist дозволених origins: `['https://app.yeturbota', 'https://staging.yeturbota']`. Webhook endpoints виключені з CORS (мають власну верифікацію підпису) |
| JWT secret rotation при активних сесіях | Підтримка двох ключів: поточний (`JWT_SECRET`) + попередній (`JWT_SECRET_PREV`). `JwtStrategy.validate()` спочатку перевіряє поточний ключ, при невдачі — попередній. Після повного циклу refresh (7 днів) — видалити попередній ключ |
| Helmet middleware не налаштований для CSP | Визначити строгий Content Security Policy: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.r2.dev; connect-src 'self' wss://*.yeturbota; frame-src https://meet.google.com https://zoom.us` |
| NestJS global exception filter не логує stack trace | Додати stack trace в серверний лог (`this.logger.error(exception.message, exception.stack)`). У відповіді клієнту — тільки `statusCode`, `message`, `error` (без stack trace). В production маскувати деталі 500-х помилок: `message: 'Internal server error'` |
| Bcrypt hash comparison timing attack | `bcrypt.compare()` вже є constant-time операцією — додатковий захист не потрібен. Додати rate limiting на login endpoint: 5 req/min per IP (вже визначено в секції Rate Limiting). При 10 невдалих спробах — temporary lockout на 15 хвилин |
| GraphQL query depth не обмежена | Depth limiting middleware: максимальна глибина запиту — 7 рівнів. Використовувати `graphql-depth-limit` пакет. Запити з глибиною > 7 — reject з 400 Bad Request |
| GraphQL introspection увімкнено в production | Вимкнути introspection в production: `GraphQLModule.forRoot({ introspection: process.env.NODE_ENV !== 'production' })`. В staging — доступ тільки через VPN |
| Logger записує чутливі дані (password, token) | PII scrubbing middleware в `LoggingInterceptor`. Список полів для маскування: `['password', 'passwordHash', 'token', 'refreshToken', 'accessToken', 'secret', 'authorization']`. Значення замінювати на `'[REDACTED]'` перед записом в лог |
| Message content містить HTML/script теги (stored XSS) | Санітизація через `isomorphic-dompurify` (серверний DOMPurify) перед збереженням у БД та перед Socket.io broadcast. `MessageService.create()`: `content = DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })` — видалити ВСІ HTML теги. Застосовувати і для REST API (`POST /cases/:id/messages`), і для Socket.io (`chat:message` event). Фронтенд: додатково використовувати Angular `[innerText]` замість `[innerHTML]` для відображення повідомлень |

### 13.6 Зберігання файлів

| Тригер | Захист |
|---|---|
| S3 upload завершується помилкою, але запис в БД вже створено | Порядок операцій: спочатку upload файлу в S3, потім (тільки при успіху) створення запису в БД. Не використовувати DB транзакцію для обгортання S3 виклику. При помилці S3 — клієнт отримує 502, запис не створюється. Scheduled cleanup job: видаляти orphan файли в S3 без відповідного запису в БД |
| File upload не перевіряє MIME type (тільки розширення) | Перевірка magic bytes файлу (перші 8 байтів) для визначення реального типу. Використовувати `file-type` npm пакет. Порівняти з заявленим MIME type та розширенням — при розходженні reject з 415 Unsupported Media Type. Whitelist дозволених типів: `image/jpeg, image/png, image/webp, application/pdf, video/mp4, audio/mpeg` |

### 13.7 Docker та Deployment

| Тригер | Захист |
|---|---|
| Docker контейнер OOM killed під час обробки кризису | Memory limits в docker-compose: `deploy: { resources: { limits: { memory: 512M } } }`. Graceful shutdown handler перехоплює SIGTERM, зберігає стан кризису в БД перед зупинкою. Restart policy: `restart: unless-stopped`. Моніторинг memory usage з alerting при > 80% |
| Docker-compose restart: залежні сервіси стартують раніше PostgreSQL | Health check для PostgreSQL: `healthcheck: { test: ["CMD-SHELL", "pg_isready -U ihelp"], interval: 5s, timeout: 5s, retries: 5 }`. `depends_on` з condition: `{ db: { condition: service_healthy }, redis: { condition: service_healthy } }`. Аналогічний healthcheck для Redis |
| Docker image містить dev-залежності | Multi-stage build (вже реалізовано в Dockerfile). Додати `.dockerignore`: `node_modules, .git, .env*, test, *.spec.ts, coverage, .vscode`. Builder stage: `npm ci`, runner stage: `npm ci --omit=dev`. Перевірка в CI: `docker image inspect` — розмір production image < 200MB |
| Nginx proxy buffer overflow при великих відповідях | Налаштування в nginx.conf: `proxy_buffer_size 16k; proxy_buffers 4 32k; proxy_busy_buffers_size 64k;`. Для file upload/download endpoints: `proxy_max_temp_file_size 1024m;`. Client max body size: `client_max_body_size 10m;` |
| Prisma schema drift (CI check) | Додати в GitHub Actions pipeline крок: `npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --exit-code`. Якщо exit code != 0 — pipeline fails |
| Відсутній graceful shutdown: активні запити обриваються | SIGTERM handler в `main.ts`: `app.enableShutdownHooks()`. NestJS `OnModuleDestroy` для кожного модуля з активними ресурсами: закриття WebSocket з'єднань, завершення поточних Bull jobs, drain HTTP connections. Timeout на shutdown: 30 секунд, після чого — force exit |
| Health check endpoint повертає деталі інфраструктури | Мінімальний health response: `{ status: 'ok' }` або `{ status: 'error' }`. Без версій компонентів, connection strings, uptime. Деталізований health check (з PostgreSQL, Redis, S3 status) — тільки на `/admin/health` з автентифікацією для ролі `admin` |

### 13.9 Бізнес-логіка та data integrity

| Тригер | Захист |
|---|---|
| #1 Два користувачі реєструються одночасно з однаковим phone | Handle Prisma P2002 unique violation на `phone` — повернути 409 Conflict (секція 2, User model) |
| #2 Дублікат webhook створює другу Person з тим же telegramChatId | Upsert або catch P2002 на `telegramChatId` unique constraint, повернути існуючу Person (секція 5, ChannelRouter step 4a) |
| #3 Два повідомлення одночасно створюють два активні CareCase | Partial unique index: `CREATE UNIQUE INDEX uq_person_active_case ON care_cases(person_id) WHERE status NOT IN ('completed', 'closed')` (секція 5, ChannelRouter step 4b) |
| #4 Consultant availability порівнюється в серверному timezone замість consultant's | Конвертувати `currentTime` в `availability.timezone` перед порівнянням (секція 6, autoAssign) |
| #5 Transfer до консультанта, який вже на maxCases | Перевірити `workload < maxCases` всередині транзакції (секція 6, transferCase) |
| #6 SLA autoReassign зациклюється (reassign → знову без відповіді → reassign) | Guard: перевірити CaseTransfer за останні 24h; якщо вже був transfer — не reassign'ити (секція 7) |
| #7 checkInactiveCases() referenced але не реалізований | Імплементувати з cursor pagination аналогічно checkUnansweredCases (секція 7) |
| #8 Attachment-only повідомлення — filenames з кризовими словами не скануються | Сканувати `attachment.name` через crisis keywords (секція 8, CrisisService) |
| #9 DB write fails після Socket.io broadcast | Persist в БД ПЕРЕД broadcast; при помилці emit `chat:error` відправнику (секція 4, chat:message) |
| #10 Користувач role=consultant без Consultant profile row | Null check `user.consultantId`, return 403 (секція 9, CaseAccessGuard) |
| #11 Адмін деактивує консультанта з активними crisis cases | Block або force-transfer перед деактивацією (секція 3, DELETE /users/:id) |
| #12 Нічні зміни 22:00-06:00 fail CHECK startTime < endTime | Дозволити overnight: розбити на два інтервали або прибрати CHECK (секція 2, Availability) |
| #13 Channel adapter sendMessage() throws | Catch, queue для retry через Bull, mark `deliveryStatus=pending` (секція 5, outgoing message) |
| #14 auth/link-provider: провайдер вже прив'язаний до іншого акаунту | Catch P2002 unique violation, return 409 з merge instructions (секція 9) |
| #15 Невалідний перехід статусу CareCase (напр. closed→in_progress) | State machine validation map з дозволеними переходами (секція 2, CareCase) |
| #16 Клієнт crashується без disconnect | Server-side heartbeat timeout 60s, автоматично mark offline (секція 4, presence:online) |
| #17 SLA таймер працює для on_hold кейсів | Виключити `on_hold` зі всіх SLA queries (секція 7) |
| #18 Person не сповіщена про закриття кейсу | Надіслати notification через ChannelRouter при close (секція 3, POST /cases/:id/close) |
| #19 Meeting не має consultantId FK — дорогі joins | Додати пряме `consultantId` поле або задокументувати join path (секція 2, Meeting) |
| #20 'не хочу жити' починається з 'не ' — false negative при negation check | Whitelist відомих кризових фраз, що містять заперечення (секція 8, crisis negation) |
| #21 Redis password видимий у healthcheck через `-a` flag | Використовувати `REDISCLI_AUTH` env var замість `-a` flag (секція 11, Docker) |
| #22 Консультант може редагувати чужу нотатку | Verify `note.authorId === currentUser.id` перед update, інакше 403 (секція 3, PATCH notes) |
| #23 autoAssign для кризового кейсу: всі консультанти відфільтровані за навантаженням | Замість повернення null — ескалація: сповістити координатора та чергового супервізора (секція 6, autoAssign крок 4→7) |
| #24 handleCrisis: кризовий кейс (high/critical) без призначеного консультанта | Після сповіщень викликати `autoAssign` для негайного призначення (секція 8, handleCrisis) |
| #25 Нове повідомлення для кейсу зі статусом on_hold | Перевести кейс в in_progress перед прикріпленням повідомлення (секція 5, ChannelRouter крок 4b) |
| #26 Supervisor потребує POST notes з isSupervisorNote=true | Дозволити supervisor POST на notes endpoint з `isSupervisorNote === true` (секція 9, CaseAccessGuard) |
| #27 checkInactiveCases: 7-денний поріг, але state machine може відхилити перехід на on_hold | Валідувати перехід через ALLOWED_TRANSITIONS перед оновленням статусу (секція 7, checkInactiveCases) |
| #28 Message content з HTML/script тегами (stored XSS) | Санітизувати через DOMPurify перед persist та Socket.io broadcast (секція 2, Message model + секція 13.5) |
| #29 transferCase: цільовий консультант має status != active | Перевірити `toConsultant.status === 'active'` перед трансфером (секція 6, transferCase) |
| #30 Person відв'язує єдиний auth provider | Перевірити наявність іншого auth методу (passwordHash або інший AuthProvider) перед unlink, інакше 409 (секція 3, DELETE unlink-provider) |

### 13.8 Канали та зовнішні API

| Тригер | Захист |
|---|---|
| Telegram API rate limit (30 msg/sec) при масовій розсилці | Черга вихідних повідомлень через Bull queue з throttling: `{ limiter: { max: 25, duration: 1000 } }` (25 msg/sec з запасом). Retry при 429 Too Many Requests з backoff, що дорівнює `retry_after` з відповіді Telegram API |
| HTTPS certificate pinning не налаштований для мобільного клієнта | Certificate pinning для API endpoints на мобільних клієнтах. Зберігати SHA-256 fingerprint сертифікату в клієнтському коді. При rotation — підтримувати 2 pins (поточний + наступний). Fallback: якщо pin не збігається — блокувати запит, показати повідомлення про оновлення додатку |

---

## Архітектурні рішення (ADR)

### ADR-001: Модульний моноліт замість мікросервісів

**Статус:** Прийнято

**Контекст:** Команда 2-3 розробники, MVP за 6-8 тижнів, 30 консультантів. Немає потреби в незалежному масштабуванні окремих компонентів.

**Рішення:** Модульний моноліт на NestJS з чіткими межами модулів. Кожний модуль — потенційний мікросервіс.

**Наслідки:** (+) Швидкий development, прості транзакції, один deploy. (-) Вертикальне масштабування, один runtime для всього.

### ADR-002: Prisma замість TypeORM

**Статус:** Прийнято

**Контекст:** Потрібен ORM з доброю типізацією, міграціями і простотою.

**Рішення:** Prisma ORM.

**Наслідки:** (+) Відмінний DX, type-safe queries, декларативна схема. (-) Обмежені складні SQL запити, N+1 потребує уваги.

### ADR-003: Adapter pattern для каналів

**Статус:** Прийнято

**Контекст:** Система має підтримувати 5+ каналів спілкування (web, Telegram, Instagram, Facebook, Viber) з можливістю додавання нових.

**Рішення:** Кожний канал реалізує інтерфейс `ChannelAdapter`. `ChannelRouter` маршрутизує повідомлення через адаптери.

**Наслідки:** (+) Легко додати новий канал, ізоляція логіки каналу. (-) Додаткова абстракція, потребує мапінгу ідентифікаторів користувачів.

### ADR-004: Crisis detection як keyword scanning (MVP)

**Статус:** Прийнято

**Контекст:** Потрібен механізм виявлення кризових ситуацій. ML-моделі занадто складні для MVP.

**Рішення:** Keyword scanning з мультимовними фразами (uk/ru/en) та рівнями ризику. В майбутньому можна додати ML/NLP.

**Наслідки:** (+) Просто, передбачувано, легко налаштувати. (-) False positives, не розуміє контекст.

### ADR-005: Redis для cache, presence і майбутніх черг

**Статус:** Прийнято

**Контекст:** Потрібен cache для частих запитів, зберігання presence статусів, в майбутньому — черги для webhook-ів.

**Рішення:** Redis як додаткова інфраструктура.

**Наслідки:** (+) Швидкий cache, pub/sub для Socket.io scaling, Bull queues. (-) Додаткова інфраструктура, ще одна БД.
