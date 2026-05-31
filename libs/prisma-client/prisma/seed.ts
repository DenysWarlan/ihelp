import { PrismaClient, Role, CourseStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString =
  process.env['DATABASE_URL'] ?? 'postgresql://ihelp:ihelp_secret@localhost:5433/ihelp';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // --- System User (used by crisis auto-reply, SYSTEM_SENDER_ID) ---

  const systemUser = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000000' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'system@ihelp.ua',
      name: 'System',
      role: Role.ADMIN,
      timezone: 'UTC',
      isActive: true,
    },
  });

  console.log(`Created system user: ${systemUser.email} (${systemUser.id})`);

  // --- Users ---

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ihelp.local' },
    update: {},
    create: {
      email: 'admin@ihelp.local',
      name: 'System Admin',
      role: Role.ADMIN,
      timezone: 'UTC',
      isActive: true,
    },
  });

  console.log(`Created admin user: ${admin.email} (${admin.id})`);

  const consultant = await prisma.user.upsert({
    where: { email: 'consultant@ihelp.local' },
    update: {},
    create: {
      email: 'consultant@ihelp.local',
      name: 'Demo Consultant',
      role: Role.CONSULTANT,
      timezone: 'UTC',
      isActive: true,
    },
  });

  console.log(`Created consultant user: ${consultant.email} (${consultant.id})`);

  const person = await prisma.user.upsert({
    where: { email: 'person@ihelp.local' },
    update: {},
    create: {
      email: 'person@ihelp.local',
      name: 'Demo Person',
      role: Role.PERSON,
      timezone: 'UTC',
      isActive: true,
    },
  });

  console.log(`Created person user: ${person.email} (${person.id})`);

  // --- Courses ---

  const coursesData = [
    {
      title: 'Коли тривога не відпускає',
      description:
        'Курс допоможе зрозуміти природу тривоги, навчить технік саморегуляції та покаже шлях до внутрішнього спокою.',
      tags: ['Тривожність', 'Стрес', 'Паніка'],
      lessons: [
        'Що таке тривога і чому вона виникає',
        'Фізіологія стресової реакції',
        'Дихальні техніки для заспокоєння',
        'Когнітивні спотворення при тривозі',
        'Практика усвідомленості',
        'Як побудувати безпечний простір',
        'Коли звертатися по допомогу',
        'Щоденні звички для зниження тривоги',
      ],
    },
    {
      title: 'Де Бог у моєму болю',
      description:
        'Курс для тих, хто переживає втрату або страждання і шукає духовну опору. Поєднання психології та віри.',
      tags: ['Біль', 'Горе', 'Віра'],
      lessons: [
        'Біль як частина людського досвіду',
        'Етапи переживання горя',
        'Молитва як інструмент зцілення',
        'Спільнота підтримки у важкі часи',
        'Відновлення надії та сенсу',
        'Шлях прощення та відпускання',
      ],
    },
    {
      title: 'Відновлення після стосунків',
      description:
        'Курс про те, як пережити розрив, відновити самооцінку та підготуватися до здорових стосунків у майбутньому.',
      tags: ['Стосунки', 'Відновлення'],
      lessons: [
        'Прийняття завершення стосунків',
        'Робота з емоціями після розриву',
        'Відновлення особистих кордонів',
        'Самооцінка та самоцінність',
        'Готовність до нових стосунків',
      ],
    },
    {
      title: 'Як пережити втрату близької людини',
      description:
        'Курс для тих, хто зіткнувся зі смертю близької людини. Допоможе пройти через горе та знайти ресурс для продовження життя.',
      tags: ['Горе', 'Втрата', 'Підтримка'],
      lessons: [
        'Шок і заперечення: перші дні після втрати',
        'Дозволити собі горювати',
        'Гнів і почуття провини',
        'Як говорити про втрату з оточенням',
        "Ритуали пам'яті та прощання",
        'Повернення до щоденних справ',
        'Коли горе стає хронічним',
      ],
    },
    {
      title: 'Емоційне вигорання: розпізнати і зупинити',
      description:
        'Курс для тих, хто відчуває постійну втому, апатію та втрату сенсу. Практичні кроки для відновлення енергії та мотивації.',
      tags: ['Вигорання', 'Робота', 'Енергія'],
      lessons: [
        'Що таке емоційне вигорання',
        'Три стадії вигорання',
        'Самодіагностика: чек-лист симптомів',
        'Фізичне відновлення: сон, рух, харчування',
        'Кордони у роботі та стосунках',
        'Пошук сенсу та цінностей',
      ],
    },
    {
      title: 'Батьківство без насильства',
      description:
        'Курс для батьків, які хочуть будувати здорові стосунки з дітьми без крику, покарань та маніпуляцій.',
      tags: ['Батьківство', 'Діти', 'Стосунки'],
      lessons: [
        'Чому діти «не слухають»: погляд нейронауки',
        'Емоційний інтелект батьків',
        'Альтернативи покаранням',
        'Як встановлювати правила без тиску',
        'Коли батьки зриваються: що робити після',
        'Підтримка для батьків: де шукати ресурс',
      ],
    },
    {
      title: 'Жити з ПТСР: перші кроки',
      description:
        'Курс для людей, які пережили травматичні події та стикаються з флешбеками, нічними жахами та гіперпильністю.',
      tags: ['ПТСР', 'Травма', 'Безпека'],
      lessons: [
        'Що таке ПТСР і чому це нормальна реакція',
        "Тіло пам'ятає: соматичні симптоми травми",
        'Техніки заземлення (grounding)',
        'Безпечне місце: візуалізація',
        'Як пояснити оточенню свій стан',
        'Коли і як звертатися до спеціаліста',
        'Щоденні практики стабілізації',
        'Маленькі перемоги: трекер відновлення',
      ],
    },
  ];

  for (const courseData of coursesData) {
    const existing = await prisma.course.findFirst({
      where: { title: courseData.title },
    });

    let course;
    if (existing) {
      course = await prisma.course.update({
        where: { id: existing.id },
        data: {
          description: courseData.description,
          status: CourseStatus.PUBLISHED,
          tags: courseData.tags,
          lessonCount: courseData.lessons.length,
        },
      });
    } else {
      course = await prisma.course.create({
        data: {
          title: courseData.title,
          description: courseData.description,
          status: CourseStatus.PUBLISHED,
          tags: courseData.tags,
          lessonCount: courseData.lessons.length,
        },
      });
    }

    // Upsert lessons
    for (let i = 0; i < courseData.lessons.length; i++) {
      const lessonTitle = courseData.lessons[i]!;
      const existingLesson = await prisma.lesson.findFirst({
        where: { courseId: course.id, title: lessonTitle },
      });

      if (!existingLesson) {
        await prisma.lesson.create({
          data: {
            courseId: course.id,
            title: lessonTitle,
            content: '',
            sortOrder: i + 1,
          },
        });
      }
    }

    console.log(
      `Created course: "${course.title}" with ${courseData.lessons.length} lessons`,
    );
  }

  console.log('Seeding complete.');
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
