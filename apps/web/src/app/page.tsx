import Link from 'next/link';
import { HomeNotificationsBanner } from '@/components/HomeNotificationsBanner';

export default function HomePage() {
  return (
    <div className="space-y-12">
      <HomeNotificationsBanner />
      <section className="sp-card relative overflow-hidden border-none bg-gradient-to-br from-white to-indigo-50/80 p-8 lg:p-12">
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-indigo-100/60 blur-2xl" />
        <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-emerald-100/50 blur-2xl" />
        <div className="relative max-w-2xl space-y-6">
          <p className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
            לסטודנטים במדעי המחשב והנדסה
          </p>
          <h1 className="text-4xl font-bold leading-tight text-indigo-950 lg:text-5xl">
            גלה מלגות, עקוב אחרי בקשות, והגש בביטחון
          </h1>
          <p className="sp-page-subtitle text-lg">
            ScholarPath מרכז את כל תהליך המלגות במקום אחד — גילוי, דירוג AI
            מותאם אישית, מעקב סטטוס וניהול פרופיל אקדמי.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/scholarships" className="sp-btn-cta">
              עיון במלגות
            </Link>
            <Link href="/recommendations" className="sp-btn-primary">
              המלצות בשבילי
            </Link>
            <Link href="/register" className="sp-btn-secondary">
              הרשמה חינם
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: 'גילוי מלגות',
            text: 'חיפוש וסינון בין עשרות מלגות רלוונטיות לתחום שלך.',
          },
          {
            title: 'מעקב בקשות',
            text: 'סטטוס ברור לכל בקשה — מהטיוטה ועד ההגשה.',
          },
          {
            title: 'פרופיל אישי',
            text: 'פרטים אקדמיים שמניעים המלצות מותאמות אישית.',
          },
        ].map((item) => (
          <div key={item.title} className="sp-card transition-shadow hover:shadow-md">
            <h2 className="mb-2 text-lg font-semibold text-indigo-950">{item.title}</h2>
            <p className="text-sm leading-relaxed text-slate-600">{item.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
