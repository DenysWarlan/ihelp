/**
 * E2E test seed script.
 *
 * Creates deterministic test data for Playwright E2E tests:
 * - 5 users (one per role) with known passwords
 * - ConsultantProfile for the consultant
 * - 2 care cases (one active, one completed)
 * - Messages and notes on the active case
 * - 1 scheduled meeting
 *
 * Run: npx tsx libs/prisma-client/prisma/seed-e2e.ts
 */
import {
  PrismaClient,
  Role,
  CaseStatus,
  CasePriority,
  CaseSource,
  ConsultantStatus,
  MeetingStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString =
  process.env['DATABASE_URL'] ?? 'postgresql://ihelp:ihelp_secret@localhost:5433/ihelp';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Deterministic UUIDs for test entities
const IDS = {
  person:     'e2e00000-0000-0000-0000-000000000001',
  consultant: 'e2e00000-0000-0000-0000-000000000002',
  supervisor: 'e2e00000-0000-0000-0000-000000000003',
  coordinator:'e2e00000-0000-0000-0000-000000000004',
  admin:      'e2e00000-0000-0000-0000-000000000005',
  case1:      'e2e00000-0000-0000-0000-00000000c001',
  case2:      'e2e00000-0000-0000-0000-00000000c002',
  meeting1:   'e2e00000-0000-0000-0000-0000000ee001',
  message1:   'e2e00000-0000-0000-0000-000000aaa001',
  message2:   'e2e00000-0000-0000-0000-000000aaa002',
  note1:      'e2e00000-0000-0000-0000-000000bbb001',
  profile:    'e2e00000-0000-0000-0000-000000ddd001',
} as const;

// All test users use this password (meets 12-char staff minimum)
const TEST_PASSWORD = 'TestPassword1!';
const SALT_ROUNDS = 10;

async function main() {
  console.log('🧪 Seeding E2E test data...');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, SALT_ROUNDS);

  // --- Users ---
  const users = [
    { id: IDS.person,      email: 'person@test.ihelp.org',      name: 'Test Person',      role: Role.PERSON },
    { id: IDS.consultant,  email: 'consultant@test.ihelp.org',  name: 'Test Consultant',  role: Role.CONSULTANT },
    { id: IDS.supervisor,  email: 'supervisor@test.ihelp.org',  name: 'Test Supervisor',  role: Role.SUPERVISOR },
    { id: IDS.coordinator, email: 'coordinator@test.ihelp.org', name: 'Test Coordinator', role: Role.COORDINATOR },
    { id: IDS.admin,       email: 'admin@test.ihelp.org',       name: 'Test Admin',       role: Role.ADMIN },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { passwordHash, name: u.name, role: u.role, isActive: true },
      create: { ...u, passwordHash, timezone: 'Europe/Kyiv', isActive: true },
    });
    console.log(`  ✓ User: ${u.email} (${u.role})`);
  }

  // --- Consultant Profile ---
  await prisma.consultantProfile.upsert({
    where: { userId: IDS.consultant },
    update: {
      specializations: ['Психологія', 'Тривожність'],
      languages: ['uk', 'en'],
      maxCases: 10,
      currentCases: 1,
      status: ConsultantStatus.AVAILABLE,
    },
    create: {
      id: IDS.profile,
      userId: IDS.consultant,
      specializations: ['Психологія', 'Тривожність'],
      languages: ['uk', 'en'],
      maxCases: 10,
      currentCases: 1,
      maxCrisisCases: 3,
      currentCrisis: 0,
      status: ConsultantStatus.AVAILABLE,
    },
  });
  console.log('  ✓ ConsultantProfile');

  // --- Care Cases ---

  // Case 1: Active (IN_PROGRESS), assigned to consultant
  await prisma.careCase.upsert({
    where: { id: IDS.case1 },
    update: { status: CaseStatus.IN_PROGRESS, consultantId: IDS.consultant },
    create: {
      id: IDS.case1,
      personId: IDS.person,
      consultantId: IDS.consultant,
      status: CaseStatus.IN_PROGRESS,
      priority: CasePriority.MEDIUM,
      source: CaseSource.WEBSITE_FORM,
      topic: 'Психологічна підтримка',
      description: 'Потребую консультацію з психологом щодо стресу та тривожності.',
      name: 'Test Person',
      country: 'Україна',
      language: 'uk',
      version: 1,
    },
  });
  console.log('  ✓ Case 1 (IN_PROGRESS)');

  // Case 2: Completed
  await prisma.careCase.upsert({
    where: { id: IDS.case2 },
    update: { status: CaseStatus.COMPLETED },
    create: {
      id: IDS.case2,
      personId: IDS.person,
      consultantId: IDS.consultant,
      status: CaseStatus.COMPLETED,
      priority: CasePriority.LOW,
      source: CaseSource.WEBSITE_FORM,
      topic: 'Адаптація після переїзду',
      description: 'Потрібна допомога з адаптацією на новому місці.',
      name: 'Test Person',
      country: 'Україна',
      language: 'uk',
      version: 2,
      resolvedAt: new Date(),
    },
  });
  console.log('  ✓ Case 2 (COMPLETED)');

  // --- Messages on Case 1 ---
  await prisma.message.upsert({
    where: { id: IDS.message1 },
    update: {},
    create: {
      id: IDS.message1,
      careCaseId: IDS.case1,
      senderId: IDS.person,
      senderRole: Role.PERSON,
      content: 'Привіт, потребую допомоги з моїм запитом.',
    },
  });

  await prisma.message.upsert({
    where: { id: IDS.message2 },
    update: {},
    create: {
      id: IDS.message2,
      careCaseId: IDS.case1,
      senderId: IDS.consultant,
      senderRole: Role.CONSULTANT,
      content: 'Доброго дня! Я ваш консультант. Розкажіть більше про вашу ситуацію.',
    },
  });
  console.log('  ✓ Messages (2)');

  // --- Note on Case 1 ---
  await prisma.caseNote.upsert({
    where: { id: IDS.note1 },
    update: {},
    create: {
      id: IDS.note1,
      careCaseId: IDS.case1,
      authorId: IDS.consultant,
      content: 'Клієнт потребує додаткової уваги. Запланувати повторну консультацію.',
      isSupervisorNote: false,
    },
  });
  console.log('  ✓ CaseNote (1)');

  // --- Meeting ---
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(14, 0, 0, 0);

  await prisma.meeting.upsert({
    where: { id: IDS.meeting1 },
    update: {},
    create: {
      id: IDS.meeting1,
      careCaseId: IDS.case1,
      consultantId: IDS.consultant,
      personId: IDS.person,
      status: MeetingStatus.SCHEDULED,
      scheduledAt: nextWeek,
      durationMin: 60,
      personTz: 'Europe/Kyiv',
      consultantTz: 'Europe/Kyiv',
      meetingUrl: 'https://meet.example.com/e2e-test',
    },
  });
  console.log('  ✓ Meeting (1)');

  console.log('\n🧪 E2E seed complete!');
  console.log(`   Password for all test users: ${TEST_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
