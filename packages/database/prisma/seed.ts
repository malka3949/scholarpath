import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const fields = [
  'מדעי המחשב',
  'הנדסת תוכנה',
  'הנדסת חשמל',
  'הנדסת מחשבים',
  'הנדסת תעשייה וניהול',
];

const scholarshipTemplates = [
  { title: 'מלגת מצוינות לסטודנטים להנדסה', org: 'קרן אקדמית' },
  { title: 'מלגת סייבר ואבטחת מידע', org: 'משרד הכלכלה' },
  { title: 'מלגת נשים בהייטק', org: 'עמותת SheCodes' },
  { title: 'מלגת מחקר בינה מלאכותית', org: 'האקדמיה הלאומית' },
  { title: 'מלגת סטודנטים מצטיינים', org: 'אוניברסיטת תל אביב' },
  { title: 'מלגת הנדסת חשמל', org: 'IEEE Israel' },
  { title: 'מלגת פיתוח תוכנה', org: 'Google for Startups' },
  { title: 'מלגת סטודנטים עולים', org: 'משרד הקליטה' },
  { title: 'מלגת קהילה טכנולוגית', org: 'Hasadna' },
  { title: 'מלגת סטארטאפים לסטודנטים', org: 'היי-טק Zone' },
];

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const studentPassword = await bcrypt.hash('student123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@scholarpath.local' },
    update: {},
    create: {
      email: 'admin@scholarpath.local',
      name: 'מנהל מערכת',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@scholarpath.local' },
    update: {},
    create: {
      email: 'student@scholarpath.local',
      name: 'סטודנט לדוגמה',
      passwordHash: studentPassword,
      role: Role.STUDENT,
      profile: {
        create: {
          fieldOfStudy: 'מדעי המחשב',
          year: 2,
          gpa: 88.5,
          preferences: { interests: ['AI', 'web'] },
        },
      },
    },
  });

  const scholarships = [];
  for (let i = 0; i < 50; i++) {
    const template = scholarshipTemplates[i % scholarshipTemplates.length];
    const field = fields[i % fields.length];
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30 + i * 7);

    scholarships.push({
      title: `${template.title} ${Math.floor(i / scholarshipTemplates.length) + 1}`,
      description: `מלגה מ${template.org} לסטודנטים בתחום ${field}. המלגה מיועדת לסטודנטים עם ממוצע גבוה ומוטיבציה לתרום לקהילה הטכנולוגית.`,
      eligibilityRules: {
        field_of_study: field,
        min_gpa: 80 + (i % 10),
        min_year: 1,
        max_year: 4,
      },
      deadline,
      sourceUrl: `https://example.org/scholarships/${i + 1}`,
      tags: [field, template.org, i % 2 === 0 ? 'מצוינות' : 'קהילה'],
    });
  }

  await prisma.scholarship.deleteMany();
  await prisma.scholarship.createMany({ data: scholarships });

  console.log('Seed complete:');
  console.log('  Admin: admin@scholarpath.local / admin123');
  console.log('  Student: student@scholarpath.local / student123');
  console.log(`  Scholarships: ${scholarships.length}`);
  console.log(`  Demo student id: ${student.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
